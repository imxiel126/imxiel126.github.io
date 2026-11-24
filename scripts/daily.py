import datetime as dt
import html
import os
import re
import shutil
import smtplib
import ssl
import subprocess
import time
from email.utils import getaddresses
import sys
from email.message import EmailMessage
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

from report_mail_utils import add_report_footer, make_report_id, make_report_subject

day = dt.date.fromisoformat(os.environ["ISSUE_DATE"])
stamp = day.strftime("%Y%m%d")
source = f"https://tv.cctv.com/lm/xwlb/day/{stamp}.shtml"
public = Path(".")
escape = html.escape


class Listings(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = {}
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        a = dict(attrs)
        url = a.get("href", "")
        if url.startswith("//"):
            url = "https:" + url
        if url.startswith("http://tv.cctv.com/"):
            url = "https://" + url[len("http://"):]
        parsed = urlsplit(url)
        if parsed.scheme == "https" and parsed.netloc == "tv.cctv.com" and re.fullmatch(
                rf"/{day:%Y/%m/%d}/VIDE[A-Za-z0-9]+\.shtml", parsed.path):
            self.anchor = (url, a.get("title", ""), [])
        else:
            self.anchor = None

    def handle_data(self, text):
        if self.anchor:
            self.anchor[2].append(text)

    def handle_endtag(self, tag):
        if tag == "a" and self.anchor:
            url, title, parts = self.anchor
            title = (title or "".join(parts)).strip()
            title = re.sub(r"^(?:完整版\s*)?(?:\[视频\]\s*)?", "", title).strip()
            if title:
                self.items[url] = title
            self.anchor = None


def full_program(title):
    return "新闻联播" in title and stamp in title and bool(re.search(r"19[:：]00", title))


def get_listings():
    # The official dated page can be empty or change markup. Try official
    # channel pages too; never use a report whose URL date differs.
    for url in (source, "https://tv.cctv.com/lm/xwlb/",
                "https://tv.cctv.com/lm/xwlb/index.shtml",
                "https://cctv.cntv.cn/lm/xinwenlianbo/index.shtml"):
        try:
            parser = Listings()
            parser.feed(subprocess.check_output(
                ["curl", "-fsSL", "--retry", "2", "--max-time", "40",
                 "-A", "Mozilla/5.0", url]).decode("utf-8", errors="replace"))
            full = [u for u,t in parser.items.items() if full_program(t)]
            if len(full) == 1 and len(parser.items) >= 2:
                print("Verified CCTV listing:", url, "items:", len(parser.items))
                return parser
            print("CCTV listing incomplete:", url, "items:", len(parser.items))
        except (subprocess.CalledProcessError, OSError, ValueError) as exc:
            print("CCTV listing unavailable:", url, type(exc).__name__)
    raise ValueError("当期节目单未核实：已检查多个央视官方入口；保留上期内容")


def verified_archive():
    # Reuse only an existing detailed archive of the exact date, with
    # matching official dated links and a complete number of detail sections.
    path = public / "archive" / f"{day}.html"
    if not path.is_file():
        return None
    article = path.read_text(encoding="utf-8")
    header = re.search(r"<main>\s*<header>.*?</header>", article, re.S)
    count = re.search(r"央视节目单收录\s+(\d+)\s+条分段报道", article)
    if not header or f"{day} 播出" not in header[0] or not count:
        return None
    n = int(count[1])
    links = set(re.findall(rf'href="https://tv\.cctv\.com/{day:%Y/%m/%d}/VIDE[A-Za-z0-9]+\.shtml"', article))
    if n < 1 or len(links) != n + 1 or article.count("央视原文与视频</a>") != n:
        return None
    if "全期速览" not in article or "观看完整节目</a>" not in article:
        return None
    if article.count("本条正文暂未取得") >= n:
        return None
    return article


def write_mail(article):
    email_css = "<style>body{font:16px/1.85 Arial,sans-serif;color:#253333;max-width:760px;margin:auto;padding:20px}section{border-bottom:1px solid #dedede;padding:18px 0}h1{font-size:34px}h2{font-size:22px}a{color:#286a5b}li{margin:8px 0}</style>"
    mail_html = re.sub(r'<link\b[^>]*\brel="stylesheet"[^>]*>', lambda m: email_css, article, flags=re.I)
    mail_html = re.sub(r"<script\b[^>]*>.*?</script>", "", mail_html, flags=re.I | re.S)
    Path(os.environ["RUNNER_TEMP"], "mail.html").write_text(mail_html, encoding="utf-8")


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
    archived = verified_archive()
    homepage = public / "index.html"
    if archived and homepage.is_file():
        current = re.search(r"<main>\s*<header>.*?<p>(\d{4}-\d{2}-\d{2}) 播出</p>.*?</header>", homepage.read_text(encoding="utf-8"), re.S)
        if current and dt.date.fromisoformat(current[1]) >= day:
            write_mail(archived)
            print("Verified existing archive reused:", day, "homepage preserved")
            return
    parser = get_listings()
    template = Path("scripts/first-issue.html").read_text()
    prefix = template.split("<main>", 1)[0]
    prefix = re.sub(r"<title>.*?</title>", "<title>知行手记 · 每日晨读 · " + str(day) + "</title>", prefix)
    sections = []
    def section(title, body):
        sections.append(f"<section><h2>{title}</h2>{body}</section>")
    def link(url, title):
        if urlsplit(url).scheme not in ("https", "http"):
            raise ValueError("无效来源")
        return f'<a href="{escape(url, quote=True)}">{escape(title)}</a>'
    full_url = next(url for url, title in parser.items.items() if full_program(title))
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
        overview.append(f'<li><strong><a href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{escape(title)}</a></strong>：{escape(lead)}</li>')
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
    social_block = "<section id=\"personal-recommendations\" class=\"social-digest\" aria-label=\"知乎与小红书个人推荐\">\n<div class=\"social-digest-head\"><div><span class=\"social-rec-eyebrow\">MY FEEDS · 个人推荐</span><h2>知乎 × 小红书 · 我的推荐</h2><p>这里仅展示你登录后在两个平台「推荐」页实际看到、并已授权同步的卡片。<strong>不使用搜索结果冒充个性化推荐。</strong></p></div><a class=\"social-rec-more\" href=\"/social/real-feed-setup.html\">同步设置与状态 ↗</a></div>\n<div class=\"social-rec-tools\"><div class=\"social-rec-tabs\" role=\"group\" aria-label=\"推荐来源\"><button type=\"button\" data-personal-filter=\"all\" aria-pressed=\"true\">全部</button><button type=\"button\" data-personal-filter=\"zhihu\" aria-pressed=\"false\">知乎</button><button type=\"button\" data-personal-filter=\"xiaohongshu\" aria-pressed=\"false\">小红书</button></div><button type=\"button\" id=\"personal-refresh\" class=\"social-rec-switch\">刷新同步数据 ↻</button></div>\n<div id=\"personal-rec-grid\" class=\"social-rec-grid\" aria-live=\"polite\"><p>正在检查推荐同步状态…</p></div><p class=\"social-rec-status\" id=\"personal-rec-status\">读取浏览器同步的推荐数据</p>\n<div class=\"social-rec-personal\"><span>直接打开平台实时推荐：</span><a href=\"https://www.zhihu.com/\" target=\"_blank\" rel=\"noopener noreferrer\">知乎「推荐」</a><a href=\"https://www.xiaohongshu.com/explore\" target=\"_blank\" rel=\"noopener noreferrer\">小红书「推荐」</a></div>\n</section><script src=\"/social/personal-feed.js?v=20261123-mixed-feeds\" defer></script>"
    research_block = "<div class=\"research-teaser\" id=\"research-teaser\" aria-label=\"最新研究动态\"><div><span class=\"overline\">RESEARCH · 自动同步</span><h2>研究与实践</h2><p class=\"teaser-lead\">氢能 · 电催化 · 检测技术 · 研究方法，集中在本站阅读。</p><a href=\"/research/\">查看研究栏目 →</a></div><div class=\"research-teaser-latest\"><small id=\"research-teaser-meta\">同步资料加载中</small><h3 id=\"research-teaser-title\">最新研究动态</h3><p id=\"research-teaser-desc\">从公开研究主页同步科技和论文资讯。</p></div></div><script src=\"/assets/research-teaser.js\" defer></script>"
    home_article = article.replace("</header>", "</header>" + research_block + social_block, 1)
    (public / "index.html").write_text(home_article + "<section><h2>往期</h2>" + past + "</section></main></body></html>")
    write_mail(article + "</main></body></html>")


def send():
    report_kind = os.environ.get("REPORT_KIND", "news").strip().lower()
    report_id = make_report_id(report_kind, day)
    msg = EmailMessage()
    msg["From"] = os.environ["SMTP_USER"]
    msg["To"] = os.environ["MAIL_TO"]
    msg["Subject"] = os.environ.get("MAIL_SUBJECT", make_report_subject(report_kind, day))
    # Some SMTP providers rewrite Message-ID. The searchable body ID below
    # remains available after QQ-to-Gmail forwarding.
    msg["Message-ID"] = f"<{report_id}@imxiel126.github.io>"
    msg["X-Report-ID"] = report_id
    msg["X-Report-Type"] = report_kind
    msg["X-Report-Date"] = day.isoformat()
    content = Path(os.environ["RUNNER_TEMP"], "mail.html").read_text(encoding="utf-8")
    content = add_report_footer(content, report_id)
    plain = re.sub(r"<(style|script)\b[^>]*>.*?</\1>", "", content, flags=re.I | re.S)
    plain = re.sub(r"<br\s*/?>|</(?:p|li|h[1-6]|section|footer)>", "\n", plain, flags=re.I)
    plain_text = html.unescape(re.sub(r"<[^>]+>", "", plain)).strip()
    if report_id not in plain_text:
        plain_text += f"\n\n报告编号：{report_id}"
    msg.set_content(plain_text)
    msg.add_alternative(content, subtype="html")
    recipients = [address for _, address in getaddresses([msg["To"]]) if address]
    if not recipients:
        raise ValueError("MAIL_TO contains no valid recipient address")

    smtp = None
    last_error = None
    # Connection/login retries happen before DATA is submitted, so they cannot
    # duplicate an accepted message.
    for attempt in range(3):
        try:
            smtp = smtplib.SMTP_SSL(
                os.environ["SMTP_HOST"], 465,
                context=ssl.create_default_context(), timeout=45
            )
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            break
        except (OSError, smtplib.SMTPException) as exc:
            last_error = exc
            print(f"SMTP_STAGE=preflight_failed attempt={attempt + 1}/3 error={type(exc).__name__}")
            if smtp is not None:
                try:
                    smtp.close()
                except Exception:
                    pass
                smtp = None
            if attempt < 2:
                time.sleep(3 * (attempt + 1))
    if smtp is None:
        raise RuntimeError("SMTP connection/login failed after three safe attempts") from last_error

    try:
        try:
            refused = smtp.send_message(msg)
        except smtplib.SMTPRecipientsRefused:
            print("SMTP_STAGE=recipient_refused")
            raise
        except Exception:
            # Once DATA may have been sent, the outcome is ambiguous. The
            # workflow leaves a pending claim and will not auto-send again.
            print("SMTP_STAGE=send_result_unknown")
            raise
        accepted = len(recipients) - len(refused)
        domains = sorted({address.rsplit("@", 1)[-1].lower() for address in recipients if "@" in address})
        masked = []
        for address in recipients:
            if "@" in address:
                local, domain = address.rsplit("@", 1)
                masked.append((local[:2] + "***" + local[-2:] if len(local) > 4 else "***") + "@" + domain.lower())
        print("SMTP recipient(s), masked: " + ", ".join(sorted(set(masked))))
        print(f"SMTP recipient domain(s): {', '.join(domains) if domains else 'unavailable'}")
        print(f"Report-ID: {report_id}")
        print(f"Message-ID: {msg['Message-ID']}")
        print(f"SMTP server accepted {accepted}/{len(recipients)} recipient(s); final delivery and inbox placement are not verified.")
        if refused:
            print("SMTP_STAGE=partial_recipient_refusal")
            raise RuntimeError(f"SMTP server refused {len(refused)} recipient(s)")
        print("SMTP_STAGE=accepted")
    finally:
        try:
            smtp.quit()
        except Exception:
            try:
                smtp.close()
            except Exception:
                pass


if __name__ == "__main__":
    if sys.argv[1] == "generate":
        generate()
    elif sys.argv[1] == "send":
        send()
    else:
        raise SystemExit("Unknown daily command")
