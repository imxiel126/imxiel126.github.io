import datetime as dt
import html
import os
import re
import shutil
import smtplib
import ssl
import subprocess
import sys
from email.message import EmailMessage
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

day = dt.date.fromisoformat(os.environ["ISSUE_DATE"])
stamp = day.strftime("%Y%m%d")
source = f"https://tv.cctv.com/lm/xwlb/day/{stamp}.shtml"
public = Path(".")
escape = html.escape


class Listings(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        url = a.get("href", "")
        title = a.get("title", "")
        if tag == "a" and title and url.startswith(f"https://tv.cctv.com/{day:%Y/%m/%d}/"):
            self.items[url] = title.removeprefix("[视频]")


def extract_details(url):
    page = subprocess.check_output(["curl", "-fsSL", "--retry", "2", "--max-time", "30", url]).decode()
    area = re.search(r'<div\b[^>]*\bid="content_area"[^>]*>(.*?)</div>', page, re.S)
    if not area:
        return []
    groups = [("", [])]
    for raw in re.findall(r"<p\b[^>]*>(.*?)</p>", area[1], re.S):
        text = html.unescape(re.sub(r"<[^>]*>", "", raw)).strip()
        text = re.sub(r"^央视网消息\s*[（(]新闻联播[）)]\s*[：:]\s*", "", text)
        if not text:
            continue
        if re.fullmatch(r"\s*<strong>[^<]+</strong>\s*", raw):
            groups.append((text, []))
        else:
            groups[-1][1].append(text)
    excerpts = []
    for heading, paragraphs in groups:
        if not paragraphs:
            continue
        sentences = re.findall(r"[^。！？]+[。！？]|[^。！？]+$", paragraphs[0])
        lead = "".join(sentences[:2])
        if len(paragraphs) > 1 and not heading:
            following = re.split(r"(?<=[。！？])", paragraphs[1])
            lead += next((line for line in following if line and line not in lead), "")
        excerpts.append((heading, lead))
    return excerpts


def generate():
    parser = Listings()
    parser.feed(subprocess.check_output(["curl", "-fsSL", "--retry", "3", "--max-time", "60", source]).decode())
    if len(parser.items) < 2 or not any(stamp in t for t in parser.items.values()):
        raise ValueError("当期节目单未核实")
    template = Path("scripts/first-issue.html").read_text()
    prefix = template.split("<main>", 1)[0]
    prefix = re.sub(r"<title>.*?</title>", "<title>新闻联播晨读 · " + str(day) + "</title>", prefix)
    sections = []
    def section(title, body):
        sections.append(f"<section><h2>{title}</h2>{body}</section>")
    def link(url, title):
        if urlsplit(url).scheme not in ("https", "http"):
            raise ValueError("无效来源")
        return f'<a href="{escape(url, quote=True)}">{escape(title)}</a>'
    full_url = next(url for url, title in parser.items.items() if stamp in title)
    reports = [(url, title) for url, title in parser.items.items() if url != full_url]
    section("本期节目", f"<p>央视节目单收录 {len(reports)} 条分段报道。</p>" + link(full_url, "观看完整节目"))
    overview = []
    detailed = 0
    for url, title in reports:
        try:
            excerpts = extract_details(url)
        except (subprocess.CalledProcessError, UnicodeError):
            excerpts = []
        if excerpts:
            detailed += 1
        lead = re.split(r'(?<=[。！？])', excerpts[0][1])[0] if excerpts else '正文暂缺'
        overview.append(f'<li><strong>{escape(title)}</strong>：{escape(lead)}</li>')
        body = "".join(
            (f"<h3>{escape(heading)}</h3>" if heading else "") + f"<p>{escape(text)}</p>"
            for heading, text in excerpts
        )
        section(title, (body or "<p>本条正文暂未取得，请查看央视原报道。</p>") + link(url, "央视原文与视频"))
    if not detailed:
        raise ValueError("本期所有分条正文均未取得")
    sections.insert(0, "<section><h2>全期速览</h2><ol>" + "".join(overview) + "</ol></section>")
    article = prefix + f"<main><header><h1>新闻联播晨读</h1><p>{day} 播出</p></header>" + "".join(sections)
    public.mkdir(exist_ok=True)
    archive = public / "archive"
    archive.mkdir(exist_ok=True)
    if day > dt.date(2026,11,20):
        if not (archive / "2026-11-20.html").exists():
            shutil.copyfile("scripts/first-issue.html", archive / "2026-11-20.html")
    (archive / f"{day}.html").write_text(article + "</main></body></html>")
    past = " · ".join(link("https://imxiel126.github.io/archive/" + p.name,p.stem) for p in sorted(archive.glob("*.html"), reverse=True) if p.stem != str(day))
    social_block = '<section><h2>知乎与小红书 · 内容中心</h2><p>把值得保存的观点、公开文章和图文笔记集中到一个阅读入口，按平台和关键词检索。</p><p><a href="/social/">进入知乎 / 小红书内容中心</a></p></section>'
    (public / "index.html").write_text(article + social_block + "<section><h2>往期</h2>" + past + "</section></main></html>")
    # Email clients cannot load the shared website CSS: use a small inline fallback.
    email_css = "<style>body{font:16px/1.85 Arial,sans-serif;color:#253333;max-width:760px;margin:auto;padding:20px}section{border-bottom:1px solid #dedede;padding:18px 0}h1{font-size:34px}h2{font-size:22px}a{color:#286a5b}li{margin:8px 0}</style>"
    mail_html = article.replace('<link rel="stylesheet" href="/assets/site.css">', email_css)
    mail_html = mail_html.replace('<script src="/assets/news.js" defer></script>', "")
    Path(os.environ["RUNNER_TEMP"], "mail.html").write_text(mail_html + "</main></body></html>")


def send():
    msg = EmailMessage()
    msg["From"] = os.environ["SMTP_USER"]
    msg["To"] = os.environ["MAIL_TO"]
    msg["Subject"] = os.environ.get("MAIL_SUBJECT", f"新闻联播晨读｜{day}")
    content = Path(os.environ["RUNNER_TEMP"], "mail.html").read_text()
    plain = re.sub(r"<(style|script)\b[^>]*>.*?</\1>", "", content, flags=re.I | re.S)
    plain = re.sub(r"<br\s*/?>|</(?:p|li|h[1-6]|section)>", "\n", plain, flags=re.I)
    msg.set_content(html.unescape(re.sub(r"<[^>]+>", "", plain)).strip())
    msg.add_alternative(content, subtype="html")
    with smtplib.SMTP_SSL(os.environ["SMTP_HOST"], 465, context=ssl.create_default_context(), timeout=45) as smtp:
        smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(msg)


if sys.argv[1] == "generate":
    generate()
else:
    send()
