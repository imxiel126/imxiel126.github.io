#!/usr/bin/env python3
import datetime as dt
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from check_daily_updates import check_local, check_morning_editions, TZ


def write_marker(path, report_id):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"report_id={report_id}\nstatus=smtp_accepted\nsmtp_accepted_at=2026-11-23T15:00:00Z\n"
        "smtp_accepted_recipients=1\nfinal_delivery=unverified\n",
        encoding="utf-8",
    )


class HealthTests(unittest.TestCase):
    def test_detects_missing_daily_archive_and_email(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            good, issues = check_local(
                root=root,
                now=dt.datetime(2026, 11, 23, 23, 45, tzinfo=TZ),
                check_delivery=True,
            )
            self.assertTrue(any("归档" in e for e in issues))
            self.assertTrue(any("新闻联播邮件" in e for e in issues))

    def test_midnight_does_not_require_unpublished_news_or_mail(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "archive").mkdir()
            # At 00:20 the previous evening's bulletin is not due until 07:37.
            (root / "archive/2026-11-22.html").write_text("x" * 600)
            now = dt.datetime(2026, 11, 24, 0, 20, tzinfo=TZ)
            _, issues = check_local(root=root, now=now, check_delivery=True)
            self.assertFalse(any("新闻晨读归档缺失" in e for e in issues))
            self.assertFalse(any("新闻联播邮件" in e for e in issues))

    def test_accepts_fresh_local_dataset_and_delivery_markers(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for folder in ("archive", "reading", ".sent", "research"):
                (root / folder).mkdir()
            now = dt.datetime(2026, 11, 23, 23, 45, tzinfo=TZ)
            (root / "archive/2026-11-22.html").write_text("x" * 600)
            (root / "reading/data.json").write_text(json.dumps({
                "ready": True, "updated": now.isoformat(), "books": [{"id": "a"}]
            }))
            (root / "reading/reflections-2000.json").write_text(json.dumps({
                "total": 2000, "cards": [{"id": str(i)} for i in range(2000)]
            }))
            (root / "reading/reflections.js").write_text("Asia/Shanghai renderDaily()")
            (root / "research/data.json").write_text(json.dumps({"synced_at": now.isoformat()}))
            (root / ".sent/weread-mail-2026-11-23").touch()
            write_marker(root / ".sent/details-2026-11-22", "news-20261122")
            write_marker(root / ".sent/edition-hydrogen-2026-11-23.txt", "hydrogen-20261123")
            write_marker(root / ".sent/edition-home-2026-11-23.txt", "home-20261123")
            ok, fail = check_local(root=root, now=now, check_delivery=True)
            self.assertEqual(fail, [])
            self.assertGreater(len(ok), 3)
            edition_ok, edition_fail = check_morning_editions(now, root=root)
            self.assertEqual(edition_fail, [])
            self.assertEqual(len(edition_ok), 2)

    def test_pending_claim_is_not_counted_as_smtp_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".sent").mkdir()
            now = dt.datetime(2026, 11, 24, 9, 30, tzinfo=TZ)
            (root / ".sent/details-2026-11-23").write_text(
                "report_id=news-20261123\nstatus=pending\nclaim_id=123-1\n",
                encoding="utf-8",
            )
            _, issues = check_local(root=root, now=now, check_delivery=True)
            self.assertTrue(any("新闻联播历史投递标记" in e for e in issues))
            (root / ".sent/edition-hydrogen-2026-11-24.txt").write_text(
                "report_id=hydrogen-20261124\nstatus=pending\nclaim_id=123-1\n",
                encoding="utf-8",
            )
            (root / ".sent/edition-home-2026-11-24.txt").write_text(
                "report_id=home-20261124\nstatus=pending\nclaim_id=124-1\n",
                encoding="utf-8",
            )
            _, edition_issues = check_morning_editions(now, root=root)
            self.assertEqual(len(edition_issues), 2)

    def test_morning_edition_check_requires_both_independent_markers(self):
        with tempfile.TemporaryDirectory() as tmp:
            now = dt.datetime(2026, 11, 24, 9, 30, tzinfo=TZ)
            ok, issues = check_morning_editions(now, root=Path(tmp))
            self.assertEqual(ok, [])
            self.assertEqual(len(issues), 2)


if __name__ == "__main__":
    unittest.main()
