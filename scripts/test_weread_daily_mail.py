#!/usr/bin/env python3
import datetime as dt
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).parent))
import weread_daily_mail as m

class DailyMailTests(unittest.TestCase):
    def test_daily_bucket_uses_china_date_and_seconds(self):
        target=dt.date(2026,11,23)
        stamp=int(dt.datetime(2026,11,23,tzinfo=m.TZ).timestamp())
        prev=int(dt.datetime(2026,11,22,tzinfo=m.TZ).timestamp())
        result=m.today_read_seconds({"readTimes":{str(stamp):1929,str(prev):250}},target)
        self.assertEqual(result,1929)
        self.assertEqual(m.duration(1929),"32 分钟")

    def test_today_titles_not_read_duration_per_book(self):
        day=dt.date(2026,11,23)
        stamp=int(dt.datetime(2026,11,23,19,0,tzinfo=m.TZ).timestamp())
        prior=stamp-86400
        shelf={"books":[{"bookId":"a","title":"科学阅读","readUpdateTime":stamp},
                        {"bookId":"b","title":"前天读的书","readUpdateTime":prior}],
               "albums":[{"albumInfo":{"name":"有声书"},"albumInfoExtra":{"lectureReadUpdateTime":stamp}}]}
        titles=m.list_today_books(shelf,day)
        self.assertEqual(len(titles),2)
        self.assertEqual({x["title"] for x in titles},{"科学阅读","有声书"})
        self.assertNotIn("seconds",titles[0])

    def test_private_notes_filtered_by_creation_date(self):
        stamp=int(dt.datetime(2026,11,23,18,tzinfo=m.TZ).timestamp())
        with patch.object(m,"call",return_value={"updated":[
            {"createTime":stamp,"markText":"今天记录的一条内容"},
            {"createTime":stamp-86400,"markText":"昨天的内容"}]}):
            notes=m.today_private_highlights("book-1",dt.date(2026,11,23))
        self.assertEqual(notes,["今天记录的一条内容"])

    def test_wrong_recipient_cannot_receive_email(self):
        with patch.dict(os.environ,{"WEREAD_MAIL_TO":"wrong@example.com","MAIL_TO":""}):
            with self.assertRaises(RuntimeError):m.authorized_recipient()

    def test_email_escapes_untrusted_content(self):
        d={"day":"2026-11-23","seconds":600,"active_count":1,"omitted":0,
           "books":[{"title":"<script>alert(1)</script>","kind":"电子书","author":"作者",
                     "intro":"<b>文本</b>","tags":[],"link":"",
                     "quote":None,"review":None,"personal":[]}],
           "reflection":None}
        rendered,plain=m.render_email(d)
        self.assertNotIn("<script>",rendered)
        self.assertIn("&lt;script&gt;",rendered)
        self.assertIn("10 分钟",plain)

    def test_reflections_exactly_2000_unique_original(self):
        obj=json.loads(Path("reading/reflections-2000.json").read_text(encoding="utf-8"))
        cards=obj["cards"]
        self.assertEqual(len(cards),2000)
        self.assertEqual(len({c["id"] for c in cards}),2000)
        self.assertEqual(len(obj["categories"]),10)
        self.assertTrue(all(c["view"] and c["practice"] for c in cards))

if __name__=="__main__":unittest.main()
