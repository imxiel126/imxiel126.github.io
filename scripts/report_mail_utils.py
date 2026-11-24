"""Shared, testable helpers for report identity and source freshness."""
from __future__ import annotations

import datetime as dt
import html
import re
from urllib.parse import urlsplit

REPORT_KINDS = frozenset({"news", "hydrogen", "home"})


def make_report_id(kind: str, report_date: dt.date) -> str:
    kind = str(kind).strip().lower()
    if kind not in REPORT_KINDS:
        raise ValueError(f"Unsupported report kind: {kind}")
    if isinstance(report_date, str):
        report_date = dt.date.fromisoformat(report_date)
    if not isinstance(report_date, dt.date):
        raise TypeError("report_date must be a datetime.date")
    return f"{kind}-{report_date:%Y%m%d}"


def make_report_subject(kind: str, report_date: dt.date) -> str:
    """Return the canonical, date-stamped subject for each daily report."""
    kind = str(kind).strip().lower()
    if isinstance(report_date, str):
        report_date = dt.date.fromisoformat(report_date)
    make_report_id(kind, report_date)  # validate kind and date
    labels = {
        "news": "新闻联播晨读",
        "hydrogen": "氢能行业晨报",
        "home": "个人主页晨报",
    }
    return f"{labels[kind]}｜{report_date:%Y-%m-%d}"


def add_report_footer(content: str, report_id: str) -> str:
    """Put a searchable, human-readable ID in both HTML and plain-text mail."""
    if report_id in content:
        return content
    footer = (
        '<footer style="margin-top:28px;padding-top:10px;border-top:1px solid #ddd;'
        'font-size:11px;color:#777">报告编号：'
        + html.escape(report_id)
        + "</footer>"
    )
    body_end = re.compile(r"</body\s*>", re.IGNORECASE)
    if body_end.search(content):
        return body_end.sub(lambda match: footer + match.group(0), content, count=1)
    return content + footer


def parse_utc_timestamp(value) -> dt.datetime:
    if isinstance(value, dt.datetime):
        stamp = value
    else:
        raw = str(value or "").strip()
        if not raw:
            raise ValueError("missing source update timestamp")
        if raw.endswith(" UTC"):
            stamp = dt.datetime.strptime(raw, "%Y-%m-%d %H:%M UTC").replace(
                tzinfo=dt.timezone.utc
            )
        else:
            stamp = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=dt.timezone.utc)
    return stamp.astimezone(dt.timezone.utc)


def validate_hydrogen_snapshot(data, now=None, max_age_hours=24):
    """Reject empty, malformed, future-dated, or stale hydrogen-news snapshots."""
    if not isinstance(data, dict) or not isinstance(data.get("hydrogen"), dict):
        raise ValueError("hydrogen news section is missing")
    section = data["hydrogen"]
    updated = parse_utc_timestamp(section.get("updated"))
    now_utc = parse_utc_timestamp(now or dt.datetime.now(dt.timezone.utc))
    age = now_utc - updated
    if age < dt.timedelta(minutes=-5):
        raise ValueError("hydrogen news timestamp is more than 5 minutes in the future")
    if age > dt.timedelta(hours=max_age_hours):
        raise ValueError(f"hydrogen news snapshot is older than {max_age_hours} hours")

    raw_items = section.get("items")
    if not isinstance(raw_items, list):
        raise ValueError("hydrogen news items are not a list")
    valid_items = []
    seen = set()
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title_cn") or item.get("title") or "").strip()
        link = str(item.get("link") or "").strip()
        parsed = urlsplit(link)
        if not title or parsed.scheme != "https" or not parsed.netloc or link in seen:
            continue
        seen.add(link)
        valid_items.append(item)
    if not valid_items:
        raise ValueError("hydrogen news has no valid, unique HTTPS articles")
    return updated, valid_items
