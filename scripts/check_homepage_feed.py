"""Fail a GitHub Pages build if personal feed is hidden, replaced by search or malformed."""
import json
import re
from pathlib import Path

home = Path("index.html").read_text(encoding="utf-8")
layout = Path("assets/morning.js").read_text(encoding="utf-8")
viewer = Path("social/personal-feed.js").read_text(encoding="utf-8")
content = json.loads(Path("social/personal-feed.json").read_text(encoding="utf-8"))
template = Path("scripts/daily.py").read_text(encoding="utf-8")
assert 'id="personal-recommendations"' in home, "Personal feed missing from homepage HTML"
assert 'id="personal-rec-grid"' in home, "Personal feed cards container missing"
assert home.index('id="personal-recommendations"') < home.index('全期速览'), "Feed must precede news overview in source"
assert '/social/personal-feed.js?' in home, "Versioned feed viewer missing"
assert '/assets/morning.js?' in home, "Versioned homepage layout script missing"
assert "function placeSocial(main)" in layout, "Homepage layout has no visible feed placement"
assert 'header.insertAdjacentElement("afterend",social)' in layout, "Feed must be placed immediately below the hero"
assert "moveSocial(main)" not in layout, "Old collapsed/bottom-of-page feed code returned"
assert "main.append(details)" not in layout, "Social recommendation cannot be appended to the end"
assert '["#personal-recommendations","知乎·小红书推荐"]' in layout, "Direct top navigation missing"
assert "const mixed=[]" in viewer and "if(xhs[i])mixed.push(xhs[i])" in viewer, "All feed must include both platforms"
assert 'id=\\"personal-recommendations\\"' in template, "Tomorrow's generated homepage would drop the feed"
assert isinstance(content.get("items"), list), "Personal feed items must be a list"
for item in content["items"]:
    assert item.get("platform") in ("zhihu", "xiaohongshu")
    assert item.get("source") == "logged_in_recommendation_page"
    assert re.match(r"^https://", str(item.get("url") or ""))
    assert item.get("title")
assert (Path("social/index.html").read_text(encoding="utf-8").find('id="real-recommendation-entry"') >= 0), "Social hub has no real feed entry"
print("OK: Homepage feed visible after layout enhancement, live feed data linked, regeneration guarded.")
