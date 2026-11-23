#!/usr/bin/env python3
"""Private daily WeRead reading email. Never writes private notes to the repository."""
from __future__ import annotations
import datetime as dt
import hashlib
import html
import json
import os
import re
import smtplib
import ssl
import sys
from email.message import EmailMessage
from pathlib import Path
from zoneinfo import ZoneInfo
from weread_sync import call, number, https

TZ=ZoneInfo("Asia/Shanghai")
# Only send to the recipient explicitly authorized for this workflow.
RECIPIENT_SHA256="413f0c35dc7f34707cb66f02439aaf3c6625d8e6819dd0fa8b785dde1d67f43e"
BASE="https://imxiel126.github.io/reading/"

def day_for(unix):
    try:
        return dt.datetime.fromtimestamp(int(unix),TZ).date()
    except (ValueError, TypeError, OSError, OverflowError):
        return None

def strip_markup(value,limit=190):
    text=html.unescape(re.sub(r"<[^>]*>"," ",str(value or "")))
    return re.sub(r"\s+"," ",text).strip()[:limit]

def today_read_seconds(response,day):
    # Official /readdata/detail weekly.readTimes is day-key -> seconds.
    buckets=response.get("readTimes") or {}
    if not isinstance(buckets,dict):raise ValueError("Invalid daily read-time bucket")
    return sum(number(value) for key,value in buckets.items() if day_for(key)==day)

def list_today_books(shelf,day):
    found=[]
    for b in shelf.get("books") or []:
        if not isinstance(b,dict):continue
        if day_for(b.get("readUpdateTime"))==day:
            found.append({"id":str(b.get("bookId","")),"title":strip_markup(b.get("title"),110),
                          "author":strip_markup(b.get("author"),80),"kind":"电子书",
                          "link":https(b.get("readerLink")) or https(b.get("deepLink")),
                          "last":number(b.get("readUpdateTime"))})
    for item in shelf.get("albums") or []:
        info=item.get("albumInfo") or {};extra=item.get("albumInfoExtra") or {}
        if day_for(extra.get("lectureReadUpdateTime"))==day:
            found.append({"id":"","title":strip_markup(info.get("name"),110),
                          "author":strip_markup(info.get("authorName"),80),"kind":"有声书",
                          "link":"","last":number(extra.get("lectureReadUpdateTime"))})
    return sorted((x for x in found if x["title"]),key=lambda x:x["last"],reverse=True)

def today_private_highlights(book_id,day):
    if not book_id:return []
    try:
        result=call("/book/bookmarklist",bookId=book_id)
        marks=result.get("updated") or []
        # Only personal highlights created on the reporting day.
        lines=[strip_markup(x.get("markText"),70) for x in marks if isinstance(x,dict)
               and day_for(x.get("createTime"))==day and x.get("markText")]
        return [x for x in dict.fromkeys(lines) if x][:2]
    except Exception as err:
        print("A private highlight section is temporarily unavailable:",type(err).__name__,file=sys.stderr)
        return []

def public_reaction(book_id):
    if not book_id:return None,None
    quote=None;review=None
    try:
        items=call("/book/bestbookmarks",bookId=book_id,chapterUid=0).get("items") or []
        for x in items:
            line=strip_markup(x.get("markText"),70)
            if 8<=len(line)<=60:quote=line;break
    except Exception as err:
        print("Popular highlights unavailable:",type(err).__name__,file=sys.stderr)
    try:
        items=call("/review/list",bookId=book_id,reviewListType=1,count=6).get("reviews") or []
        for x in items:
            rv=((x.get("review") or {}).get("review") or {}) if isinstance(x,dict) else {}
            line=strip_markup(rv.get("content"),90)
            if 15<=len(line)<=70:review=line;break
    except Exception as err:
        print("Reader comments unavailable:",type(err).__name__,file=sys.stderr)
    return quote,review

def key_points(book_id,public_books):
    record=public_books.get(book_id,{})
    guide=record.get("guide") or {}
    intro=strip_markup(guide.get("intro"),130)
    tags=[strip_markup(x,32) for x in guide.get("keywords",[]) if x][:4]
    if intro or tags:return intro,tags
    try:
        if book_id:
            info=call("/book/info",bookId=book_id)
            return strip_markup(info.get("intro"),130),[]
    except Exception as err:
        print("Book metadata unavailable:",type(err).__name__,file=sys.stderr)
    return "",[]

def duration(seconds):
    seconds=number(seconds)
    if not seconds:return "0 分钟"
    h,m=divmod(seconds//60,60)
    return f"{h} 小时 {m} 分钟" if h else f"{m} 分钟"

def authorized_recipient():
    address=(os.getenv("WEREAD_MAIL_TO") or os.getenv("MAIL_TO") or "").strip().lower()
    if hashlib.sha256(address.encode()).hexdigest()!=RECIPIENT_SHA256:
        raise RuntimeError("Recipient secret missing or does not match explicitly authorized mailbox; configure WEREAD_MAIL_TO")
    return address

def build_digest(day=None, fetch=call):
    day=day or dt.datetime.now(TZ).date()
    weekly=fetch("/readdata/detail",mode="weekly")
    secs=today_read_seconds(weekly,day)
    shelf=fetch("/shelf/sync")
    active=list_today_books(shelf,day)
    try:
        public=json.loads(Path("reading/data.json").read_text(encoding="utf-8"))
        books={str(x.get("id")):x for x in public.get("books",[]) if x.get("id")}
    except (OSError,ValueError):books={}
    details=[]
    for book in active[:6]:
        bid=book["id"]
        intro,tags=key_points(bid,books)
        quote,review=public_reaction(bid)
        personal=today_private_highlights(bid,day)
        details.append({**book,"intro":intro,"tags":tags,"quote":quote,"review":review,"personal":personal})
    try:
        thoughts=json.loads(Path("reading/reflections-2000.json").read_text(encoding="utf-8"))["cards"]
        offset=(day-dt.date(2026,1,1)).days
        reflection=thoughts[(offset*7)%len(thoughts)]
    except (OSError,KeyError,ValueError,IndexError):
        reflection=None
    return {"day":day.isoformat(),"seconds":secs,"active_count":len(active),
            "books":details,"omitted":max(0,len(active)-len(details)),
            "reflection":reflection}

def render_email(d):
    esc=lambda x:html.escape(str(x or ""))
    sections=[]
    for i,b in enumerate(d["books"],1):
        items=[f"<h3>{i}. {esc(b['title'])}</h3>",
               f"<p>类型：{esc(b['kind'])}　作者：{esc(b['author'])}</p>"]
        if b["intro"]:items.append("<p><b>内容简介：</b>"+esc(b["intro"])+"</p>")
        if b["tags"]:items.append("<p><b>主题词：</b>"+esc("、".join(b["tags"]))+"</p>")
        if b["quote"]:items.append("<p><b>书中热门划线（其他读者）：</b>「"+esc(b["quote"])+"」</p>")
        if b["review"]:items.append("<p><b>其他读者公开看法：</b>「"+esc(b["review"])+"」</p>")
        if b["personal"]:
            items.append("<p><b>今天新做的个人划线（仅本邮件）：</b></p><ul>"+
                         "".join("<li>"+esc(x)+"</li>" for x in b["personal"])+"</ul>")
        if b["link"]:items.append('<p><a href="'+esc(b["link"])+'">前往微信读书</a></p>')
        sections.append("<section>"+"".join(items)+"</section>")
    if not sections:sections=["<p>书架最新阅读时间中，尚未发现今天有打开记录的书。可能是尚未阅读或设备数据未同步。</p>"]
    thought=d.get("reflection")
    piece="<h2>今日阅读思考</h2>"
    if thought:piece+="<p><b>"+esc(thought["title"])+"</b></p><p>"+esc(thought["view"])+"</p><p><b>今日实践：</b>"+esc(thought["practice"])+"</p>"
    time_label=dt.datetime.now(TZ).strftime("%H:%M")
    notice="今日总时长取微信读书本周接口中本地日期的分桶，统计截至发送时。书单依据书架最后阅读时间判断，不代表每本书的精确当日分钟数；书籍内容要点是公开简介和主题词，不是全书正文摘要。"
    html_body=("<!doctype html><html lang='zh-CN'><meta charset='utf-8'><body style='font:16px/1.7 Arial,sans-serif;max-width:700px;margin:auto;color:#18322d;padding:20px'>"+
         "<h1>微信读书 · 每日阅读复盘</h1><p><strong>"+esc(d["day"])+"</strong> · 截至北京时间 "+time_label+"</p>"+
         "<p style='padding:18px;background:#edf7f3;border-radius:14px'>今日阅读/收听总时长：<b>"+
         esc(duration(d["seconds"]))+"</b>　·　书架当日有阅读记录：<b>"+str(d["active_count"])+" 项</b></p>"+
         "<h2>今天在读什么</h2>"+"".join(sections)+
         ("<p>另外 "+str(d["omitted"])+" 本未逐一展开；避免邮件过长。</p>" if d["omitted"] else "")+
         "<section>"+piece+"</section><p><a href='"+BASE+"'>打开阅读中心</a></p><hr><p style='font-size:12px;color:#61776f'>"+
         esc(notice)+"</p></body></html>")
    plain=re.sub(r"</(?:p|h1|h2|h3|li|section)>","\n",html_body)
    plain=html.unescape(re.sub(r"<[^>]+>","",plain))
    return html_body,plain

def send(d):
    address=authorized_recipient()
    host=os.environ.get("SMTP_HOST","")
    user=os.environ.get("SMTP_USER","")
    password=os.environ.get("SMTP_PASSWORD","")
    if not all([host,user,password]):raise RuntimeError("Missing existing SMTP_HOST / SMTP_USER / SMTP_PASSWORD repository secrets")
    doc,plain=render_email(d)
    msg=EmailMessage()
    msg["From"]=user
    msg["To"]=address
    msg["Subject"]=f"微信读书晚间复盘｜{d['day']}"
    msg.set_content(plain)
    msg.add_alternative(doc,subtype="html")
    with smtplib.SMTP_SSL(host,465,context=ssl.create_default_context(),timeout=45) as server:
        server.login(user,password)
        server.send_message(msg)
    print("Daily WeRead email successfully submitted to SMTP service (recipient redacted).")

if __name__=="__main__":
    digest=build_digest()
    if "--dry-run" in sys.argv:
        # No private reading content or recipient is printed.
        print("Digest assembled: "+digest["day"]+"; active books "+str(digest["active_count"]))
    else:
        send(digest)
