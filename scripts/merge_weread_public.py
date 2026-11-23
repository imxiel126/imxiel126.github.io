#!/usr/bin/env python3
"""Safely combine a just-fetched public WeRead snapshot with latest GitHub data.

Only public book guide metadata and a previously known reading progress value are
merged. Private excerpts and hidden books are NEVER copied from the older snapshot.
"""
import copy
import datetime as dt
import json
import sys
from pathlib import Path

def when(x):
    if not x: return dt.datetime.min.replace(tzinfo=dt.timezone.utc)
    try:
        value=dt.datetime.fromisoformat(str(x).replace("Z","+00:00"))
        return value if value.tzinfo else value.replace(tzinfo=dt.timezone.utc)
    except (ValueError, TypeError):
        return dt.datetime.min.replace(tzinfo=dt.timezone.utc)

def merged_guide(candidate,latest):
    a=candidate if isinstance(candidate,dict) else {}
    b=latest if isinstance(latest,dict) else {}
    if not a:return copy.deepcopy(b)
    if not b:return copy.deepcopy(a)
    # Preserve newer metadata; never discard an already fetched public excerpt
    # because the other run has not fetched this card yet.
    newer,older=(a,b) if (a.get("checkedOn") or "") >= (b.get("checkedOn") or "") else (b,a)
    merged=copy.deepcopy(older)
    merged.update(newer)
    for key in ("quote","review"):
        if not merged.get(key) and older.get(key):merged[key]=older[key]
        if not merged.get(key) and newer.get(key):merged[key]=newer[key]
    for key in ("quoteCheckedOn","reviewCheckedOn"):
        value=max(str(a.get(key) or ""),str(b.get(key) or ""))
        if value:merged[key]=value
    for key in ("terms","keywords"):
        if not merged.get(key) and older.get(key):merged[key]=older[key]
    return merged

def combine(generated,current):
    if not isinstance(generated,dict) or not generated.get("ready"):
        raise ValueError("Invalid new public snapshot")
    if not isinstance(current,dict) or not current.get("ready"):
        return generated
    result=copy.deepcopy(generated)
    old={str(b.get("id")):b for b in current.get("books",[]) if isinstance(b,dict) and b.get("id")}
    # Book inclusion and all private-note text are exclusively owned by the
    # freshly synced public data, so a book removed/hidden cannot return.
    for book in result.get("books",[]):
        prior=old.get(str(book.get("id")))
        if not prior:continue
        book["guide"]=merged_guide(book.get("guide"),prior.get("guide"))
        if book.get("progress") is None and isinstance(prior.get("progress"),(int,float)):
            book["progress"]=prior["progress"]
    if when(current.get("updated"))>when(result.get("updated")):
        # A newer run already synchronized the reader statistics.
        result["updated"]=current["updated"]
        if isinstance(current.get("stats"),dict):result["stats"]=current["stats"]
    return result

def main():
    generated=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    path=Path(sys.argv[2])
    try: current=json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:current={}
    result=combine(generated,current)
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Merged public snapshot without reintroducing hidden books or personal excerpts.")

if __name__=="__main__":main()
