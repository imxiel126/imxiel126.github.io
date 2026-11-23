#!/usr/bin/env python3
import datetime as dt
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from check_daily_updates import check_local, TZ

class HealthTests(unittest.TestCase):
    def test_detects_missing_daily_archive_and_email(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            good,issues=check_local(root=root,now=dt.datetime(2026,11,23,23,45,tzinfo=TZ))
            self.assertTrue(any("归档" in e for e in issues))
            self.assertTrue(any("邮件" in e for e in issues))
    def test_accepts_fresh_local_dataset(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for p in ("archive","reading",".sent","research"):
                (root/p).mkdir()
            now=dt.datetime(2026,11,23,23,45,tzinfo=TZ)
            (root/"archive/2026-11-22.html").write_text("x"*600)
            (root/"reading/data.json").write_text(json.dumps({"ready":True,"updated":now.isoformat(),"books":[{"id":"a"}]}))
            (root/"reading/reflections-2000.json").write_text(json.dumps({"total":2000,"cards":[{"id":str(i)} for i in range(2000)]}))
            (root/"reading/reflections.js").write_text("Asia/Shanghai renderDaily()")
            (root/"research/data.json").write_text(json.dumps({"synced_at":now.isoformat()}))
            (root/".sent/weread-mail-2026-11-23").touch()
            ok,fail=check_local(root=root,now=now)
            self.assertEqual(fail,[])
            self.assertGreater(len(ok),3)

if __name__=="__main__":unittest.main()
