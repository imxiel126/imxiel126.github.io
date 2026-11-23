#!/usr/bin/env python3
"""Fail fast on broken personal-site navigation, assets or learning datasets.

Read-only validation: no private notes, API tokens or user data is touched.
"""
from __future__ import annotations
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html","learn/index.html","library/index.html","reading/index.html",
         "notes/index.html","research/index.html","social/index.html"]
REQUIRED = ["assets/site.css","assets/news.js","assets/morning.js",
            "learn/app.js","learn/learn.css","library/app.js","research/app.js",
            "scripts/first-issue.html","scripts/daily.py"]
WORKFLOWS = [
    ".github/workflows/daily.yml", ".github/workflows/weread.yml",
    ".github/workflows/research-sync.yml", ".github/workflows/social-pages.yml",
    ".github/workflows/notes-pages.yml"
]
def assert_file(path):
    p=ROOT/path
    if not p.is_file() or p.stat().st_size < 20:
        raise AssertionError("Missing or empty website file: "+path)
    return p.read_text(encoding="utf-8")

def main():
    for path in PAGES+REQUIRED:
        assert_file(path)
    for path in PAGES:
        body=assert_file(path)
        if "href=\"/learn/\"" not in body:
            raise AssertionError("Learning nav link missing: "+path)
        if "href=\"/assets/site.css\"" not in body:
            raise AssertionError("Shared CSS missing: "+path)
        if "class=\"site-nav\"" not in body:
            raise AssertionError("Shared nav missing: "+path)
    for path in WORKFLOWS:
        content=assert_file(path)
        if "learn" not in content or "assets" not in content:
            raise AssertionError("Deployment misses learning resources: "+path)
        if "actions/upload-pages-artifact@v3" not in content:
            raise AssertionError("Pages upload action missing: "+path)
    first=assert_file("scripts/first-issue.html")
    home=assert_file("index.html")
    if "/assets/morning.js" not in first or "/assets/morning.js" not in home:
        raise AssertionError("Daily generation would omit morning dashboard")
    if 'href="/learn/"' not in first:
        raise AssertionError("Tomorrow's regenerated homepage would omit learning nav")
    source=assert_file("scripts/daily.py")
    if 'research_block + social_block' not in source:
        raise AssertionError("Daily regeneration lost homepage research or social content")
    if 'escape(url, quote=True)' not in source:
        raise AssertionError("Original CCTV links not escaped")
    for item in ["books","quotes","insights"]:
        data=json.loads(assert_file("library/data/"+item+".json"))
        rows=data.get("items")
        if not isinstance(rows,list) or len(rows)!=1000:
            raise AssertionError("Learning index should contain 1000 "+item)
        ids=[r.get("id") for r in rows]
        if len(set(ids))!=len(ids):
            raise AssertionError("Duplicate learning IDs in "+item)
    reflections=json.loads(assert_file("reading/reflections-2000.json"))
    if len(reflections.get("cards",[]))!=2000:
        raise AssertionError("Reading reflections archive is not complete")
    for path in ["assets/news.js","assets/morning.js","learn/app.js","library/app.js","research/app.js"]:
        result=subprocess.run(["node","--check",str(ROOT/path)],capture_output=True,text=True)
        if result.returncode:
            raise AssertionError("JavaScript syntax error in "+path+": "+result.stderr[:400])
    print("PASS: site pages and study paths, navigation, auto-publish, 3000 knowledge cards, 2000 reflections, JavaScript syntax.")

if __name__=="__main__":
    main()
