#!/usr/bin/env python3
"""Incrementally enrich PUBLIC WeRead bookshelf cards from official book metadata.

No private notes, unapproved personal highlights, or full copyrighted text.
Uses WeRead Skill v1.0.6 (book.md, notes.md, review.md).
"""
import datetime as dt
import html
import json
import os
import re
import sys
import time
from pathlib import Path

from weread_sync import call, number, short, https

DATA = Path("reading/data.json")
# Only report a term when it literally occurs in the book's public title or introduction.
VOCAB = {
    "测量不确定度": "用于表示测量结果可合理归属于被测量值的分散程度。",
    "计量溯源": "将测量结果通过不间断的校准链关联到参考标准。",
    "校准": "在规定条件下建立测量标准与仪器示值之间关系的活动。",
    "标准物质": "具有规定特性值与用途、可用于测量或质量控制的物质。",
    "拉曼光谱": "利用非弹性散射光分析物质的分子振动或结构信息。",
    "深紫外": "通常指波长较短的紫外光谱区域，具体范围依应用而异。",
    "光谱分析": "依据光与物质相互作用形成的光谱获取成分或结构信息。",
    "碳排放": "温室气体排放研究中对含碳排放活动的常用描述。",
    "碳足迹": "产品、活动或组织在特定边界内的温室气体排放量。",
    "生命周期评价": "评估产品系统从资源获取到处置各阶段环境影响的方法。",
    "温室气体": "能吸收并重新发射红外辐射、产生温室效应的气体。",
    "电解水": "通过外加电能分解水以产生氢气和氧气的技术过程。",
    "电解槽": "进行电化学反应的核心设备；制氢时用于电解水。",
    "氢能": "以氢作为能量载体的生产、储运与利用相关体系。",
    "储能": "将能源转换并暂存，在需要时释放使用的过程和技术。",
    "燃料电池": "将燃料与氧化剂的化学能直接转换为电能的电化学装置。",
    "具身智能": "智能系统通过身体与环境交互完成感知与行动的范式。",
    "机器学习": "利用数据学习规律并用于预测、识别或决策的方法。",
    "大语言模型": "在大量文本数据上训练、能进行语言建模的模型。",
    "人工智能": "研究及构建具备感知、推理、学习等能力系统的领域。",
    "神经网络": "由相互连接的计算单元组成、可通过训练拟合关系的模型。",
    "无人机": "无需机载驾驶员、可遥控或自主运行的航空器。",
    "统计学": "研究数据收集、分析、推断和不确定性的学科。",
    "贝叶斯": "与使用先验信息及观察证据更新概率相关的方法体系。",
    "概率": "描述随机事件发生可能性的数量。",
    "风险管理": "识别、分析、评价并处理风险的系统过程。",
    "复利": "在已有本金和累积收益基础上继续计息的机制。",
    "行为模型": "用于解释或预测行为及其影响因素的概念框架。",
    "认知偏差": "思维判断中重复出现的系统性偏离。",
    "元认知": "对自身认知过程进行监控与调节的能力。",
    "心理学": "研究行为、心理过程及其机制的学科。",
    "颈椎": "位于颈部的七块椎骨及其相关结构的统称。",
    "筋膜": "连接并包裹肌肉、器官等结构的结缔组织。",
    "拉伸": "通过改变关节或肌肉长度位置进行柔韧性练习。",
    "肌肉": "通过收缩产生力和运动的组织。",
}

def plain(value, limit):
    txt = html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt[:limit]

def keywords_and_terms(book, intro):
    source = (book.get("title","")+" "+intro)
    matched = sorted((word for word in VOCAB if word in source), key=lambda x: (-len(x),x))
    terms=[{"name":w,"definition":VOCAB[w]} for w in matched[:6]]
    category=[p.strip() for p in re.split(r"[-/·]",book.get("category","")) if p.strip()]
    keys=[]
    for key in [*matched, *category]:
        if key not in keys: keys.append(key)
    return keys[:8],terms

def one_short_quote(items):
    # Only ONE short, complete public quotation per book, never a long passage.
    for item in items or []:
        if not isinstance(item,dict):continue
        value=plain(item.get("markText"),90)
        if 10 <= len(value) <= 64 and not re.search(r"[\n\r]",value):
            return {"text":value,"highlights":number(item.get("totalCount"))}
    return None

def one_public_review(items):
    for item in items or []:
        if not isinstance(item,dict): continue
        detail=((item.get("review") or {}).get("review") or {})
        value=plain(detail.get("content"),240)
        # Whole short commentary only; do not cut a long review into a deceptive quote.
        if 16 <= len(value) <= 82:
            star=number(detail.get("star"))
            author=(detail.get("author") or {})
            return {"text":value,"author":plain(author.get("name"),28),
                    "stars":star//20 if star in (20,40,60,80,100) else None}
    return None

def enrich(book, with_discussion=True):
    info=call("/book/info",bookId=book["id"])
    intro=plain(info.get("intro"),260)
    keywords,terms=keywords_and_terms(book,intro)
    rating=info.get("newRating")
    try:rating=float(rating)
    except (TypeError,ValueError):rating=None
    if rating is not None and not (0<=rating<=100):rating=None
    guide={
        "intro":intro,
        "publisher":plain(info.get("publisher"),80),
        "rating":rating,
        "ratingCount":number(info.get("newRatingCount")),
        "keywords":keywords,
        "terms":terms,
        "quote":None,
        "review":None,
        "checkedOn":dt.datetime.now(dt.timezone.utc).date().isoformat(),
    }
    if with_discussion:
        fill_discussion(guide,book["id"])
    return guide

def fill_discussion(guide,book_id):
    """Enhance an already fetched public book card; don't duplicate requests."""
    if not guide.get("quoteCheckedOn"):
        try:
            popular=call("/book/bestbookmarks",bookId=book_id,chapterUid=0)
            guide["quote"]=one_short_quote(popular.get("items"))
            guide["quoteCheckedOn"]=dt.datetime.now(dt.timezone.utc).date().isoformat()
        except (RuntimeError,ValueError,OSError) as exc:
            print("Public highlight unavailable:",type(exc).__name__,file=sys.stderr)
    if not guide.get("reviewCheckedOn"):
        try:
            review=call("/review/list",bookId=book_id,reviewListType=1,count=5)
            guide["review"]=one_public_review(review.get("reviews"))
            deep=review.get("deepVRecommendValue")
            if isinstance(deep,(int,float)) and 0<=deep<=1000:
                guide["deepRecommendationPct"]=round(deep/10,1)
            guide["reviewCheckedOn"]=dt.datetime.now(dt.timezone.utc).date().isoformat()
        except (RuntimeError,ValueError,OSError) as exc:
            print("Public reader review unavailable:",type(exc).__name__,file=sys.stderr)


def main():
    if os.getenv("WEREAD_PUBLIC_ENABLED")!="true":
        raise SystemExit("Public sync is disabled")
    data=json.loads(DATA.read_text(encoding="utf-8"))
    if not data.get("ready"):raise RuntimeError("Sync bookshelf before enriching")
    books=data.get("books") or []
    today=dt.datetime.now(dt.timezone.utc).date()
    # First complete every public book introduction. This does not fetch the book text.
    intro_limit=min(250,max(1,number(os.getenv("WEREAD_INTRO_BATCH","239"))))
    discussion_limit=min(32,max(1,number(os.getenv("WEREAD_DISCUSSION_BATCH","24"))))
    missing=[]
    for book in books:
        if book.get("type")!="ebook":continue
        guide=book.get("guide")
        checked=(guide or {}).get("checkedOn") if isinstance(guide,dict) else None
        try: age=(today-dt.date.fromisoformat(checked)).days
        except (ValueError,TypeError):age=999
        if not isinstance(guide,dict) or not guide or age>=90:
            missing.append(book)
    enriched=0
    failed=0
    for i,book in enumerate(missing[:intro_limit]):
        try:
            # Updating book/info only; public highlights and opinions are a second pass.
            existing=book.get("guide") or {}
            guide=enrich(book,with_discussion=False)
            for key in ("quote","review","quoteCheckedOn","reviewCheckedOn","deepRecommendationPct"):
                if key in existing:guide[key]=existing[key]
            book["guide"]=guide
            enriched+=1
        except (RuntimeError,ValueError,OSError) as exc:
            failed+=1
            print(f"Book description unavailable for {book.get('id')}: {type(exc).__name__}",file=sys.stderr)
            if failed%10==0:time.sleep(2)
        if (i+1)%25==0:
            print(f"Intro backfill: {i+1}/{min(intro_limit,len(missing))} checked",flush=True)
            # Checkpoint locally; workflow commits the final result only after success.
            DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        time.sleep(0.12)
    # Quotes and reviews are published only when the provider has concise public entries.
    # Progressively enrich a limited set each day, without clearing existing cards.
    to_discuss=[b for b in books if b.get("type")=="ebook"
                and isinstance(b.get("guide"),dict) and b["guide"].get("checkedOn")
                and (not b["guide"].get("quoteCheckedOn") or not b["guide"].get("reviewCheckedOn"))]
    discussed=0
    for b in to_discuss[:discussion_limit]:
        fill_discussion(b["guide"],b["id"])
        discussed+=1
        time.sleep(0.15)
    data["schema"]=2
    data["guideSource"]="Official WeRead public book info and optional concise public highlights/reviews; no private reading text"
    DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    total=sum(bool(b.get("guide",{}).get("checkedOn")) for b in books)
    qtotal=sum(bool(b.get("guide",{}).get("quoteCheckedOn")) for b in books)
    rtotal=sum(bool(b.get("guide",{}).get("reviewCheckedOn")) for b in books)
    print(f"Public introductions {total}/{len(books)}; added {enriched}, failed {failed}; quote checks {qtotal}, review checks {rtotal}, newly attempted {discussed}",flush=True)

if __name__=="__main__":main()
