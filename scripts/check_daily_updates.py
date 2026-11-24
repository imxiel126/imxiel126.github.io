#!/usr/bin/env python3
"""Audit daily Pages updates; alert without storing personal data.

Checks data freshness, expected prior-day news archive, reading email marker,
reflection rotation, and public Pages endpoints.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import os
import smtplib
import ssl
import sys
import time
import urllib.error
import urllib.request
from email.message import EmailMessage
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Shanghai")
SITE = "https://imxiel126.github.io"
ROOT = Path(".")

def parse_datetime(value):
    try:
        value = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if value.tzinfo is None:
            return value.replace(tzinfo=dt.timezone.utc)
        return value
    except (ValueError, TypeError):
        return None

def check_local(root=None, now=None):
    root = root or ROOT
    now = now or dt.datetime.now(TZ)
    issues = []
    success = []
    # The prior-evening CCTV issue is generated at 07:37 and retried at 08:47.
    # Before 10:00 China time, requiring yesterday's issue would cause midnight
    # false alarms. Check the latest issue that is actually due for publishing.
    expected = now.date()-dt.timedelta(days=2 if now.hour < 10 else 1)
    archive = root / "archive" / f"{expected:%Y-%m-%d}.html"
    if not archive.is_file() or archive.stat().st_size < 500:
        issues.append(f"新闻晨读归档缺失：{archive.name}")
    else:
        success.append("晨读归档已生成")

    try:
        x = json.loads((root/"reading/data.json").read_text(encoding="utf-8"))
        updated = parse_datetime(x.get("updated"))
        age = ((now.astimezone(dt.timezone.utc)-updated.astimezone(dt.timezone.utc)).total_seconds()/3600) if updated else 9999
        if not x.get("ready") or not x.get("books"):
            issues.append("微信读书公开数据未就绪或书架为空")
        elif age > 30:
            issues.append(f"微信读书公开数据超过30小时未更新（约 {age:.1f} 小时）")
        elif age < -1:
            issues.append("微信读书更新时间异常（未来日期）")
        else:
            success.append(f"微信读书书架已同步（{len(x['books'])} 项，约 {age:.1f} 小时前）")
    except (OSError, ValueError, TypeError, KeyError) as err:
        issues.append("微信读书数据文件损坏或缺失："+type(err).__name__)

    try:
        cards=json.loads((root/"reading/reflections-2000.json").read_text(encoding="utf-8"))
        js=(root/"reading/reflections.js").read_text(encoding="utf-8")
        if len(cards.get("cards",[]))!=2000 or cards.get("total")!=2000 or "Asia/Shanghai" not in js or "renderDaily()" not in js:
            issues.append("阅读思考库数量不足或每日轮换代码缺失")
        else:success.append("2000 条阅读思考卡与按日期轮换代码正常")
    except (OSError,ValueError,TypeError) as err:
        issues.append("阅读思考库检查失败："+type(err).__name__)

    if now.hour >= 23:
        marker=root/".sent"/f"weread-mail-{now:%Y-%m-%d}"
        if not marker.exists():
            issues.append("今日22:00阅读复盘邮件缺少成功投递标记")
        else: success.append("今日阅读复盘邮件有成功投递标记")

    try:
        research=json.loads((root/"research/data.json").read_text(encoding="utf-8"))
        stamp=parse_datetime(research.get("synced_at"))
        age=((now.astimezone(dt.timezone.utc)-stamp.astimezone(dt.timezone.utc)).total_seconds()/3600) if stamp else 9999
        if age < -1:
            issues.append("研究资料内容更新时间异常（未来日期）")
        elif age > 20:
            # The timestamp means last CONTENT change, not the most recent sync job.
            success.append(f"研究资料最近一次内容变化约 {age:.1f} 小时前（应另查同步任务是否成功）")
        else:
            success.append(f"研究资料内容最近有变化（约 {age:.1f} 小时前）")
    except (OSError,ValueError,TypeError) as err:
        issues.append("研究资料检查失败："+type(err).__name__)

    return success, issues

def check_online():
    issues=[]
    success=[]
    for suffix,needle in [
        ("/", 'href="/learn/"'),
        ("/learn/", 'id="daily-items"'),
        ("/brain/", 'id="brain-inbox-list"'),
        ("/brain/app.js", "zhixing-brain-v1"),
        ("/assets/brain-bridge.js", "ZhixingBrain"),
        ("/learn/app.js", "zhixing-days-v1"),
        ("/reading/", 'id="reading-reflections"'),
        ("/reading/reflections-2000.json", '"total":2000'),
        ("/research/", 'id="research-title"'),
    ]:
        endpoint=SITE+suffix
        problem=None
        for attempt in range(2):
            try:
                req=urllib.request.Request(endpoint,headers={"User-Agent":"PersonalPagesMonitor/1.0","Cache-Control":"no-cache"})
                with urllib.request.urlopen(req,timeout=20) as response:
                    body=response.read(500_000).decode("utf-8","replace")
                    if response.status!=200: raise ValueError("HTTP "+str(response.status))
                if needle not in body:raise ValueError("Expected page content absent")
                problem=None
                break
            except (urllib.error.URLError,OSError,ValueError) as e:
                problem=type(e).__name__
                if attempt==0:time.sleep(3)
        if problem:issues.append(f"线上页面 {suffix} 不可用或不是新版本（{problem}）")
        else:success.append(f"线上页面 {suffix} 可以访问")
    return success,issues

def notify_failure(issues,now):
    # Reuse the same verified private recipient as the daily mail workflow.
    from weread_daily_mail import authorized_recipient
    recipient=authorized_recipient()
    host=os.getenv("SMTP_HOST")
    user=os.getenv("SMTP_USER")
    secret=os.getenv("SMTP_PASSWORD")
    if not all([host,user,secret]):raise RuntimeError("Missing SMTP credentials for health alert")
    message=EmailMessage()
    message["From"]=user
    message["To"]=recipient
    message["Subject"]=f"GitHub 个人主页自动更新异常｜{now:%Y-%m-%d}"
    content=("检测时间（北京时间）："+now.isoformat()+"\n\n"+
             "\n".join(f"- {x}" for x in issues)+"\n\n"+
             "检查运行记录：https://github.com/imxiel126/imxiel126.github.io/actions\n"+
             "此邮件只包含系统状态，不包含私人阅读内容。")
    message.set_content(content)
    with smtplib.SMTP_SSL(host,465,context=ssl.create_default_context(),timeout=45) as conn:
        conn.login(user,secret)
        conn.send_message(message)

def main():
    now=dt.datetime.now(TZ)
    passed,failed=check_local(now=now)
    # A push may start before GitHub Pages finishes; avoid premature website alerts.
    if os.environ.get("GITHUB_EVENT_NAME") == "push":
        print("Online website verification deferred until the next scheduled health check.")
        site_ok,site_failed=[],[]
    else:
        site_ok,site_failed=check_online()
    passed.extend(site_ok)
    failed.extend(site_failed)
    for text in passed:print("OK:",text)
    for text in failed:print("FAILED:",text,file=sys.stderr)
    if failed:
        try:
            notify_failure(failed,now)
            print("Health alert submitted to SMTP service.")
        except Exception as err:
            print("Health alert delivery failed:",type(err).__name__,file=sys.stderr)
        return 1
    print("All daily checks passed.")
    return 0

if __name__=="__main__":sys.exit(main())
