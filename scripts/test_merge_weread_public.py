#!/usr/bin/env python3
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from merge_weread_public import combine

class MergeTests(unittest.TestCase):
    def test_guide_from_parallel_run_is_preserved(self):
        incoming={"ready":True,"updated":"2026-11-23T15:00:00+00:00","books":[{"id":"1","title":"公开书籍","guide":{"checkedOn":"2026-11-23","intro":"简介"}}],"stats":{"weekly":{"seconds":9}}}
        latest={"ready":True,"updated":"2026-11-23T15:01:00+00:00","books":[{"id":"1","guide":{"checkedOn":"2026-11-23","intro":"简介","quote":{"text":"公开短句"},"quoteCheckedOn":"2026-11-23"}}],"stats":{"weekly":{"seconds":11}}}
        result=combine(incoming,latest)
        self.assertEqual(result["books"][0]["guide"]["quote"]["text"],"公开短句")
        self.assertEqual(result["stats"]["weekly"]["seconds"],11)
    def test_never_restore_private_excerpts_or_removed_book(self):
        incoming={"ready":True,"books":[{"id":"1","guide":{},"excerpts":[]}],"stats":{}}
        latest={"ready":True,"books":[{"id":"1","excerpts":[{"text":"private"}],"guide":{"intro":"metadata"}},{"id":"secret","guide":{}}],"stats":{}}
        result=combine(incoming,latest)
        self.assertEqual(len(result["books"]),1)
        self.assertEqual(result["books"][0]["excerpts"],[])
        self.assertEqual(result["books"][0]["guide"]["intro"],"metadata")
    def test_empty_previous_works(self):
        incoming={"ready":True,"books":[],"stats":{}}
        self.assertEqual(combine(incoming,{}),incoming)

if __name__=="__main__":unittest.main()
