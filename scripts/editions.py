import datetime
import html
import json
import os
import subprocess
import sys
from pathlib import Path

esc = html.escape
parts = []
def section(title, text):
    parts.append(f"<h2>{esc(title)}</h2><p>{esc(text).replace(chr(10), '<br>')}</p>")

if sys.argv[1] == "home":
    from playwright.sync_api import sync_playwright
    with sync_playwright() as driver:
        browser = driver.chromium.launch()
        page = browser.new_page(timezone_id="Asia/Shanghai")
        page.goto("https://xie-l.github.io/", wait_until="domcontentloaded")
        for card in page.locator("main section").all():
            title = card.locator("h2").first.inner_text()
            if card.get_attribute("id") == "news-feed":
                for tab in card.locator(".news-tab").all():
                    tab.click()
                    card.locator(".news-item, .news-status:not(:has(.fa-spinner))").first.wait_for()
                    section(tab.inner_text(), card.locator("#news-content").inner_text())
            else:
                page.wait_for_function("(id) => !document.getElementById(id).innerText.includes('加载中')", arg=card.get_attribute("id"), timeout=30000)
                section(title, card.inner_text().split("\n",1)[-1])
        page.locator(".wt-tab").first.wait_for()
        for city in page.locator(".wt-tab").all():
            city.click()
            section(city.inner_text()+"天气", page.locator("#w-weather").inner_text()+"\n"+page.locator("#w-weather-time").inner_text())
        browser.close()
else:
    url = "https://raw.githubusercontent.com/xie-l/xie-l.github.io/main/data/news.json"
    data = json.loads(subprocess.check_output(["curl","-fsSL","--retry","3",url]))
    items = data["hydrogen"]["items"]
    if not items: raise ValueError("氢能资讯源暂无数据")
    section("行业动态", "采集时间："+data["hydrogen"]["updated"])
    import re
    for item in items:
        section(item.get("title_cn") or item["title"],html.unescape(re.sub("<[^>]+>","",item.get("description",""))) + "\n" + item["link"])
    day = datetime.date.fromisoformat(os.environ["ISSUE_DATE"]).toordinal()
    angles = [
        ("最低稳定负荷","反推合成装置低负荷时的逐小时耗氢量，比较电解槽最低产量，找出供过于求的时段。","预测偏差","用实际出力替换日前预测，重算储氢余量，记录首次无法满足需求的小时。"),
        ("检修窗口","将化工装置的检修日历与制氢计划对齐，估算停产期间仍需消纳的氢量。","错峰维护","比较同时检修和轮换检修对库存低点、弃电量的影响。"),
        ("交付承诺","把月度订单拆成不可延期与可调整的批次，分别评估缺氢代价。","滚动排产","每次预测更新只调整尚未锁定的生产批次，观察是否减少反复启停。"),
        ("缓冲库存","按连续低风低光小时数估算可用库存，而非只看储罐标称容量。","备用策略","比较提前备氢与临时外购对连续交付的影响。"),
        ("用氢品质","分别列出各用氢单元的纯度与压力要求，检查总产氢量之外的交付瓶颈。","辅助设备","将压缩和净化环节纳入同一供需时间表，检查是否出现氢量够而交付不足。"),
        ("合同柔性","衡量允许延后一个班次交货能释放多少负荷调节空间。","成本边界","将启停损耗和延期交货成本计入低价电时段的排产比较。"),
        ("物料平衡","把制氢量换算为可支持的化工产品产量，再与实际订单对表。","联合复盘","用小时级缺供、弃电和库存变化复盘昨日计划，区分预测问题与设备约束。")]
    a,b,c,d = angles[day % len(angles)]
    case = items[(day//len(angles)) % len(items)].get("title_cn") or items[(day//len(angles)) % len(items)]["title"]
    section("化工负荷端对制氢的耦合需求",f"今日对照报道：{case}\n观察角度：{a}。{b}这是分析问题，报道未披露的参数需另行核实。")
    section("波动情况下如何实现一体化的生产运营",f"今日运营推演：{c}。{d}")
Path(os.environ["RUNNER_TEMP"],"mail.html").write_text("<html><body>"+ "".join(parts)+"</body></html>")
