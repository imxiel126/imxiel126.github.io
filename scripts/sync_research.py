#!/usr/bin/env python3
"""Read only selected PUBLIC research feeds from xie-l.github.io.

Deliberately excludes backups, admin, config, files, and personal diary content.
No GitHub token or upstream write permission is required.
"""
import datetime as dt
from email.utils import parsedate_to_datetime
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

SOURCE = "https://raw.githubusercontent.com/xie-l/xie-l.github.io/main/"
OUTPUT = Path("research/data.json")
USER_AGENT = "zhixing-research-sync/1.0 (+https://imxiel126.github.io/research/)"
CHANNELS = {
    "hydrogen": "hydrogen",
    "papers": "papers",
    "energy": "energy",
    "energy_cn": "energy",
    "energy_intl": "energy",
    "policy_nea": "policy",
    "policy_ndrc": "policy",
}


def fetch_json(path):
    if path not in {"data/academic.json", "data/news.json", "data/blog-index.json"}:
        raise ValueError("Unapproved upstream path")
    request = urllib.request.Request(SOURCE + path, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=35) as response:
        body = response.read(900_001)
        if len(body) > 900_000:
            raise ValueError("Source payload too large: " + path)
    parsed = json.loads(body.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("Upstream object was not a JSON dictionary: " + path)
    return parsed


def plain(value, limit=500):
    raw = html.unescape(re.sub(r"<[^>]*>", " ", str(value or "")))
    return re.sub(r"\s+", " ", raw).strip()[:limit]


def public_url(value):
    try:
        u = urllib.parse.urlsplit(value)
        if u.scheme == "https" and u.hostname and u.username is None and u.password is None:
            return value[:1400]
    except (ValueError, TypeError):
        pass
    return ""


def papers_from(source):
    author = source.get("author") or {}
    result = []
    for item in (source.get("top_papers") or [])[:12]:
        if not isinstance(item, dict):
            continue
        doi = str(item.get("doi") or "").strip()
        if not re.fullmatch(r"10\.\d{4,9}/[A-Za-z0-9._;()/:+-]+", doi):
            doi = ""
        title = plain(item.get("title"), 300)
        if title:
            result.append({
                "title": title,
                "year": item.get("year") if isinstance(item.get("year"), int) else None,
                "venue": plain(item.get("venue"), 150),
                "citations": item.get("citations") if isinstance(item.get("citations"), int) else None,
                "doi": doi,
            })
    return {
        "author_name": plain(author.get("name"), 120),
        "paper_count": max(0, int(author.get("paper_count") or 0)),
        "citation_count": max(0, int(author.get("citation_count") or 0)),
        "h_index": max(0, int(author.get("h_index") or 0)),
        "updated": plain(source.get("updated"), 60),
        "source": plain(source.get("source"), 80),
        "papers": result,
    }


def normalized_date(value):
    raw = plain(value, 80)
    if re.match(r"^\d{4}-\d{2}-\d{2}", raw):
        return raw[:10]
    try:
        return parsedate_to_datetime(raw).date().isoformat()
    except (ValueError, TypeError, IndexError):
        return ""


def news_from(source):
    selected = []
    seen = set()
    for upstream_key, group in CHANNELS.items():
        block = source.get(upstream_key)
        if not isinstance(block, dict):
            continue
        entries = block.get("items")
        if not isinstance(entries, list):
            continue
        for x in entries[:8]:
            if not isinstance(x, dict):
                continue
            url = public_url(x.get("link"))
            title = plain(x.get("title_cn") or x.get("title"), 200)
            if not title or not url or (url, title) in seen:
                continue
            seen.add((url, title))
            selected.append({
                "type": group,
                "title": title,
                "date": normalized_date(x.get("pubDate")),
                "summary": plain(x.get("description"), 430),
                "source": plain(block.get("source") or upstream_key, 80),
                "url": url,
            })
    selected.sort(key=lambda x: x["date"], reverse=True)
    return selected[:55]


def articles_from(source):
    selected = []
    for x in source.get("posts") or []:
        if not isinstance(x, dict):
            continue
        category = str(x.get("category") or "")
        path = x.get("path")
        # Narrow explicit whitelist: do NOT import life/thoughts/personal writings.
        if category not in {"tech", "analysis"} or not isinstance(path, str):
            continue
        if not re.fullmatch(r"blog/(tech|analysis)/[^/]+\.html", path):
            continue
        title = plain(x.get("title"), 190)
        if not title or title.lower().startswith("index"):
            continue
        selected.append({
            "title": title,
            "date": plain(x.get("date"), 20),
            "category": category,
            "summary": plain(x.get("summary"), 380),
            "url": "https://xie-l.github.io/" + urllib.parse.quote(path, safe="/-_.~"),
        })
    selected.sort(key=lambda x: x["date"], reverse=True)
    return selected[:12]


def build():
    academic = papers_from(fetch_json("data/academic.json"))
    news = news_from(fetch_json("data/news.json"))
    writing = articles_from(fetch_json("data/blog-index.json"))
    if not academic["papers"] or not news:
        raise ValueError("Essential upstream research feeds are empty; keeping old data")
    return {
        "version": 1,
        "source_repository": "xie-l/xie-l.github.io",
        "source_url": "https://xie-l.github.io/",
        "academic": academic,
        "news": news,
        "writing": writing,
    }


def main():
    new = build()
    old = {}
    if OUTPUT.exists():
        try:
            old = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            old = {}
    unchanged = {k: v for k, v in old.items() if k != "synced_at"} == new
    if unchanged:
        print("Research feeds unchanged; retaining last successful sync time")
        return
    new["synced_at"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(new, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    print("Research data updated: {} papers, {} news entries, {} technical posts".format(
        len(new["academic"]["papers"]), len(new["news"]), len(new["writing"])
    ))


if __name__ == "__main__":
    main()
