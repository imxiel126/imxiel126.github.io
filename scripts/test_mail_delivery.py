#!/usr/bin/env python3
import datetime as dt
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from report_mail_utils import (
    add_report_footer,
    make_report_id,
    validate_hydrogen_snapshot,
)


class ReportMailTests(unittest.TestCase):
    def test_report_ids_are_unique_by_kind_and_date(self):
        day = dt.date(2026, 11, 24)
        self.assertEqual(make_report_id("news", day), "news-20261124")
        self.assertEqual(make_report_id("hydrogen", day), "hydrogen-20261124")
        self.assertEqual(make_report_id("home", day), "home-20261124")
        self.assertEqual(len({make_report_id(k, day) for k in ("news", "hydrogen", "home")}), 3)

    def test_unknown_report_kind_is_rejected(self):
        with self.assertRaises(ValueError):
            make_report_id("other", dt.date(2026, 11, 24))

    def test_html_footer_contains_searchable_report_id(self):
        result = add_report_footer("<html><body><p>正文</p></body></html>", "home-20261124")
        self.assertIn("报告编号：home-20261124", result)
        self.assertTrue(result.index("报告编号") < result.index("</body>"))

    def test_hydrogen_snapshot_accepts_fresh_utc_source(self):
        now = dt.datetime(2026, 11, 24, 7, 0, tzinfo=dt.timezone.utc)
        data = {"hydrogen": {
            "updated": "2026-11-24 05:59 UTC",
            "items": [
                {"title_cn": "报道A", "link": "https://example.com/a"},
                {"title": "报道B", "link": "https://example.com/b"},
            ],
        }}
        updated, items = validate_hydrogen_snapshot(data, now=now)
        self.assertEqual(len(items), 2)
        self.assertEqual(updated, dt.datetime(2026, 11, 24, 5, 59, tzinfo=dt.timezone.utc))

    def test_hydrogen_snapshot_rejects_stale_data(self):
        now = dt.datetime(2026, 11, 24, 7, 0, tzinfo=dt.timezone.utc)
        data = {"hydrogen": {
            "updated": "2026-11-22 05:59 UTC",
            "items": [{"title": "旧报道", "link": "https://example.com/a"}],
        }}
        with self.assertRaises(ValueError):
            validate_hydrogen_snapshot(data, now=now)

    def test_hydrogen_snapshot_rejects_future_and_empty_articles(self):
        now = dt.datetime(2026, 11, 24, 7, 0, tzinfo=dt.timezone.utc)
        future = {"hydrogen": {
            "updated": "2026-11-24 07:10 UTC",
            "items": [{"title": "报道", "link": "https://example.com/a"}],
        }}
        with self.assertRaises(ValueError):
            validate_hydrogen_snapshot(future, now=now)
        empty = {"hydrogen": {
            "updated": "2026-11-24 06:00 UTC",
            "items": [
                {"title": "", "link": "https://example.com/a"},
                {"title": "坏链接", "link": "http://example.com/b"},
            ],
        }}
        with self.assertRaises(ValueError):
            validate_hydrogen_snapshot(empty, now=now)

    def test_hydrogen_snapshot_deduplicates_articles(self):
        now = dt.datetime(2026, 11, 24, 7, 0, tzinfo=dt.timezone.utc)
        item = {"title": "报道", "link": "https://example.com/a"}
        _, items = validate_hydrogen_snapshot({"hydrogen": {
            "updated": "2026-11-24 06:00 UTC", "items": [item, dict(item)]
        }}, now=now)
        self.assertEqual(len(items), 1)


if __name__ == "__main__":
    unittest.main()
