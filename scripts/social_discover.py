#!/usr/bin/env python3
"""Discover *public search results* for the personal homepage.

Not the user's logged-in Zhihu/Xiaohongshu recommendation feed.
No cookies, private tokens or bypasses. Bing RSS may be unavailable; failure
leaves previously verified suggestions unchanged.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import logging
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

FILE = Path("social/recommendations.json")
TOPICS = [
    ("zhihu", "site:zhuanlan.zhihu.com/p/ 科研 方法 论文", "科研方法"),
    ("zhihu", "site:zhihu.com/question/ 计量 校准 检测", "计量与检测"),
    ("zhihu", "site:zhuanlan.zhihu.com/p/ 电解水 氢能", "氢能"),
    ("zhihu", "site:zhihu.com/question/ AI 研究 机器学习", "人工智能"),
    ("xiaohongshu", "site:xiaohongshu.com/explore/ 科研 笔记", "科研方法"),
    ("xiaohongshu", "site:xiaohongshu.com/explore/ 氢能 电解水", "氢能"),
    ("xiaohongshu", "site:xiaohongshu.com/explore/ 计量 检测", "计量与检测"),
    ("xiaohongshu", "site:xiaohongshu.com/explore/ 读书 笔记", "读书与成长"),
]
MAX_RESULTS_PER_QUERY = 5
MAX_PUBLIC_SEARCH_RESULTS = 40


def public_link(value: str, platform: str) -> str:
    try:
        u = urllib.parse.urlsplit(value)
    except ValueError:
        return ""
    if u.scheme != "https" or u.username or u.password or u.port:
        return ""
    host = (u.hostname or "").lower()
    path = u.path
    if platform == "zhihu":
        if host not in ("www.zhihu.com", "zhihu.com", "zhuanlan.zhihu.com"):
            return ""
        if not (path.startswith("/question/") or path.startswith("/p/") or
                path.startswith("/tardis/bd/art/")):
            return ""
    elif platform == "xiaohongshu":
        if host not in ("www.xiaohongshu.com", "xiaohongshu.com"):
            return ""
        if not (path.startswith("/explore/") or path.startswith("/discovery/item/")):
            return ""
    else:
        return ""
    if not re.search(r"\d{6,}", path):
        return ""
    return urllib.parse.urlunsplit(("https", host, path.rstrip("/"), "", ""))


def clean(text: str, limit: int = 180) -> str:
    text = html.unescape(re.sub(r"<[^>]*>", " ", text))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].rstrip()


def get_public_results(topic: tuple[str, str, str]) -> list[dict]:
    platform, query, label = topic
    params = urllib.parse.urlencode({"q": query, "format": "rss"})
    url = "https://www.bing.com/search?" + params
    request = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 (compatible; PublicTopicDigest/1.0)"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = response.read(1_000_000)
        root = ET.fromstring(payload)
    except Exception as exc:  # network issues must not overwrite prior recommendations
        logging.warning("Public RSS unavailable (%s): %s", label, exc)
        return []
    discovered = []
    for entry in root.findall(".//item")[:MAX_RESULTS_PER_QUERY]:
        link = public_link((entry.findtext("link") or "").strip(), platform)
        title = clean(entry.findtext("title") or "", 105)
        if not link or not title:
            continue
        summary = clean(entry.findtext("description") or "", 130)
        discovered.append({
            "platform": platform, "kind": "article", "title": title,
            "summary": summary, "url": link, "topic": label,
            "origin": "public_search",
            "discovered_at": dt.datetime.now(dt.timezone.utc).date().isoformat(),
        })
    return discovered


def main() -> None:
    data = json.loads(FILE.read_text(encoding="utf-8"))
    previous = data.get("items", [])
    public = [x for x in previous if x.get("origin") == "public_search"]
    curated = [x for x in previous if x.get("origin") != "public_search"]
    seen = {x["url"]: x for x in public}
    with ThreadPoolExecutor(max_workers=4) as executor:
        batches = list(executor.map(get_public_results, TOPICS))
    discovered_count = 0
    for batch in batches:
        for item in batch:
            if item["url"] in seen:
                continue
            seen[item["url"]] = item
            discovered_count += 1
    if not discovered_count:
        print("No new public search results; existing feed remains unchanged.")
        return
    public = sorted(seen.values(), key=lambda x: x.get("discovered_at", ""), reverse=True)
    data["items"] = curated + public[:MAX_PUBLIC_SEARCH_RESULTS]
    data["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    data["source_label"] = "公开网页检索与人工精选；不等于账号算法推荐"
    FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Added", discovered_count, "public results; saved", len(data["items"]), "entries.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
