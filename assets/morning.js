/* Personal morning dashboard: official evening news, research updates, daily learning.
   Progressive enhancement: the verified news report remains readable when JS is unavailable. */
(()=>{"use strict";
const el=(tag,content,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=String(content);return n;};
const internal=(href,title)=>{const a=el("a",title);a.href=href;return a;};
const safeLink=(href,title)=>{try{const u=new URL(href);if(!["https:","http:"].includes(u.protocol))return null;const a=el("a",title);a.href=u.href;a.target="_blank";a.rel="noopener noreferrer";return a;}catch{return null;}};
const short=(s,len)=>{const t=String(s||"").replace(/\s+/g," ").trim();return t.length>len?t.slice(0,len)+"…":t;};
const safeDate=(s)=>/^\d{4}-\d{2}-\d{2}$/.test(s||"")?s:"";
const dateInChina=()=>{const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const get=k=>parts.find(x=>x.type===k)?.value||"";return [get("year"),get("month"),get("day")].join("-");};
let dailyData=[],shift=0;
function classification(s){
 const list=[
  ["计量检测",/计量|检定|校准|检测|监测|光谱|质量基础设施|标准/],
  ["氢能能源",/氢能|氢气|制氢|新能源|储能|能源|电网|电力|风电|光伏|煤炭/],
  ["科研科技",/科研|科技|人工智能|具身智能|数据|机器人|实验|创新|芯片|航天|先进制造/],
  ["生态环境",/碳排|低碳|生态|环保|水资源|水污染|生物多样性|减排/],
  ["产业经济",/产业|制造业|工业|市场|经济|财政|投资|消费|就业/]
 ];return list.find(x=>x[1].test(s))?.[0]||"综合资讯";
}
function score(title,summary){
 const a=title+" "+short(summary,120),t=classification(a);
 const weight={"计量检测":12,"氢能能源":11,"科研科技":10,"生态环境":9,"产业经济":4,"综合资讯":0}[t];
 return weight+(title.length<30?1:0);
}
function buildNav(header,main){
 header.classList.add("morning-hero");
 const h1=header.querySelector("h1");if(h1)h1.textContent="每日晨读";
 const old=header.querySelector("p");
 const date=(old?.textContent||header.querySelector("time")?.getAttribute("datetime")||"").match(/\d{4}-\d{2}-\d{2}/)?.[0]||"";
 if(old)old.textContent=date?"《新闻联播》播出日期 "+date+" · 每天整理上一晚的节目":"《新闻联播》资料与个人学习，持续更新";
 const intro=el("p","今天有什么新信息？哪些值得点开读？哪些能用于工作和学习？","morning-intro");
 if(h1)h1.insertAdjacentElement("afterend",intro);
 const state=el("div",undefined,"morning-status"),cctv=el("span",date?"联播已整理至 "+date:"联播日期以央视播出为准");
 cctv.id="morning-cctv-date";
 const source=el("span","研究动态：正在读取更新日期…");source.id="morning-source-date";
 state.append(cctv,source);header.append(state);
 const actions=el("nav",undefined,"morning-shortcuts");actions.setAttribute("aria-label","晨读快捷入口");
 [["#personal-recommendations","知乎·小红书推荐"],["#morning-highlights","今日重点"],["#morning-updates","研究新讯"],["#morning-learning","每日学习"],["#overview-wrapper","全部报道"],["/research/","研究中心"],["/library/","知识库"]].forEach(([url,label])=>actions.append(internal(url,label)));
 header.append(actions);
}
function reportData(main){
 const sections=[...main.querySelectorAll(":scope > section.report")];
 return sections.map((section,index)=>{
  const heading=section.querySelector(".report-title")||section.querySelector(":scope > h2");
  const content=section.querySelector(".report-body")||section;
  const source=[...content.querySelectorAll("a[href]")].find(a=>{try{return new URL(a.href).hostname==="tv.cctv.com"}catch{return false;}})||null;
  const summary=content.querySelector("p");
  return {index,title:heading?.textContent?.trim()||"",summary:summary?.textContent?.trim()||"",sourceUrl:source?.href||"",section};
 }).filter(x=>x.title&&x.sourceUrl);
}
function highlights(main,records){
 const area=el("section",undefined,"morning-highlights");area.id="morning-highlights";area.setAttribute("aria-labelledby","highlights-title");
 const head=el("div",undefined,"morning-section-title");
 const left=el("div");left.append(el("span","FIRST READ · 先读重点","overline"),el("h2","今天先看这几条"));head.append(left,el("span","从央视节目中按你的学习方向优先排序；完整列表在下方","morning-muted"));area.append(head);
 const list=el("div",undefined,"morning-headline-list");
 records.map(x=>({...x,score:score(x.title,x.summary)})).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,5).forEach((x,i)=>{
  const item=el("article",undefined,"morning-headline"),no=el("span",String(i+1).padStart(2,"0"),"morning-num"),body=el("div",undefined,"morning-headline-body");
  const tag=el("span",classification(x.title+" "+short(x.summary,100)),"morning-tag");
  const title=el("h3"),a=safeLink(x.sourceUrl,x.title);if(a)title.append(a);else title.textContent=x.title;
  const summary=el("p",short(x.summary,130)||"查看央视原文以获取报道详情");
  const extra=el("div",undefined,"morning-headline-extra"),read=internal("#report-"+(x.index+1),"看本站整理");
  read.addEventListener("click",()=>{const detail=x.section.querySelector("details");if(detail)detail.open=true;});
  const origin=safeLink(x.sourceUrl,"央视原文 ↗");extra.append(read);if(origin)extra.append(origin);
  const keep=el("button","＋ 稍后读");keep.type="button";keep.className="morning-save-later";
  keep.addEventListener("click",()=>{
   try{
    const storageKey="zhixing-queue-v1",raw=JSON.parse(localStorage.getItem(storageKey)||"[]"),list=Array.isArray(raw)?raw:[];
    if(list.some(row=>row.url===x.sourceUrl)){keep.textContent="已加入待读";keep.disabled=true;return;}
    const stamp=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const d=type=>stamp.find(part=>part.type===type)?.value||"";
    list.unshift({url:x.sourceUrl,title:x.title,source:"新闻联播",saved:[d("year"),d("month"),d("day")].join("-")});
    localStorage.setItem(storageKey,JSON.stringify(list.slice(0,200)));
    keep.textContent="已加入待读";keep.disabled=true;
   }catch{keep.textContent="保存失败（浏览器存储不可用）";}
  });
  extra.append(keep);
  body.append(tag,title,summary,extra);item.append(no,body);list.append(item);
 });
 if(!list.children.length)area.append(el("p","目前没有找到带央视原文链接的报道；可查看下方节目列表。","morning-empty"));
 else area.append(list);
 const ref=main.querySelector(".research-teaser")||main.querySelector(":scope > section");
 main.insertBefore(area,ref||null);
}
function wrapOverview(main){
 const overview=main.querySelector("#overview");
 if(!overview)return;
 const details=el("details",undefined,"morning-overview");details.id="overview-wrapper";
 const sum=el("summary");
 const heading=overview.querySelector(":scope > h2");
 const count=overview.querySelectorAll("li").length;
 sum.append(el("span","全部节目速览 · "+count+" 条","morning-overview-label"),el("span","展开所有标题 +","morning-overview-action"));
 details.addEventListener("toggle",()=>{const hint=details.querySelector(".morning-overview-action");if(hint)hint.textContent=details.open?"收起列表 −":"展开所有标题 +";});
 if(heading)heading.remove();
 overview.replaceWith(details);details.append(sum,overview);
}
function updateSource(root){
 const format=raw=>{const d=new Date(raw);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(d);};
 const stamp=format(root.synced_at);
 const target=document.getElementById("morning-source-date");
 if(target)target.textContent=stamp?"研究资讯最近同步 "+stamp:"研究资讯：已读取资料";
 const feed=document.getElementById("morning-news-updates");if(!feed)return;feed.replaceChildren();
 const news=Array.isArray(root.news)?root.news:[];
 const selected=[...news.filter(x=>x.type==="hydrogen"),...news.filter(x=>x.type==="papers"),...news.filter(x=>x.type==="policy")];
 const seen=new Set();
 selected.filter(x=>{if(!x.url||seen.has(x.url))return false;seen.add(x.url);return true;}).slice(0,4).forEach(x=>{
  const row=el("div",undefined,"morning-radar-item");
  const title=safeLink(x.url,short(x.title,100));
  if(title)row.append(title);else row.append(el("span",short(x.title,100)));
  const meta=el("small",([x.type==="hydrogen"?"氢能":x.type==="papers"?"论文":"政策",safeDate(x.date)].filter(Boolean).join(" · ")));
  row.append(meta);feed.append(row);
 });
 if(!feed.children.length)feed.append(el("p","暂时没有新的专业资讯，可进入研究中心查看历史内容。","morning-empty"));
}
function createUpdates(main){
 const zone=el("div",undefined,"morning-workbench"),research=main.querySelector("#research-teaser");
 zone.id="morning-updates";
 const panel=el("section",undefined,"morning-radar");panel.setAttribute("aria-label","最新专业资讯");
 const title=el("div",undefined,"morning-panel-heading");
 title.append(el("div","研究新讯 · 继续跟进","morning-panel-title"),internal("/research/","全部研究 →"));
 panel.append(title,el("div",undefined,"morning-radar-list"));panel.lastChild.id="morning-news-updates";
 const study=el("section",undefined,"morning-study");study.id="morning-learning";study.setAttribute("aria-label","每日学习");
 const heading=el("div",undefined,"morning-panel-heading");
 const more=el("button","换一组 ↻");more.type="button";more.id="morning-change-study";
 heading.append(el("div","每日三学 · 小步积累","morning-panel-title"),more);
 const items=el("div","正在读取今日学习卡片…","morning-study-items");items.id="morning-study-items";
 study.append(heading,items);zone.append(panel,study);
 const anchor=main.querySelector("#overview")||main.querySelector(":scope > section.report");
 main.insertBefore(zone,anchor||null);
 if(research){research.classList.add("morning-research-feature");zone.insertBefore(research,panel);}
 more.addEventListener("click",()=>{shift++;renderLearning();});
 fetch("/research/data.json",{cache:"no-store"})
  .then(r=>{if(!r.ok)throw Error(r.status);return r.json();})
  .then(updateSource)
  .catch(()=>{const s=document.getElementById("morning-source-date");if(s)s.textContent="研究资讯：更新状态暂不可用";const radar=document.getElementById("morning-news-updates");if(radar)radar.textContent="资讯暂时无法读取，请进入研究中心查看。";});
 Promise.all(["books","quotes","insights"].map(k=>fetch("/library/data/"+k+".json").then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(d=>({type:k,items:d.items}))))
  .then(groups=>{dailyData=groups;renderLearning();})
  .catch(()=>{items.textContent="学习卡片暂时无法读取，请进入知识库查看。";});
}
function daySeed(){const d=dateInChina();const n=Date.parse(d+"T00:00:00Z");return Number.isFinite(n)?Math.floor(n/86400000):0;}
function renderLearning(){
 const box=document.getElementById("morning-study-items");if(!box||!dailyData.length)return;
 box.replaceChildren();
 const day=daySeed();
 for(let i=0;i<dailyData.length;i++){
  const set=dailyData[i];let list=Array.isArray(set.items)?set.items:[];
  if(set.type==="books"){const ready=list.filter(x=>x.verifiedSummary);if(ready.length)list=ready;}
  if(!list.length)continue;
  const item=list[((day*11+shift*19+i*29)%list.length+list.length)%list.length];
  const kind={books:"书",quotes:"句",insights:"思"}[set.type];
  const title=set.type==="quotes"?item.content:item.title||item.topic;
  const summary=set.type==="books"?item.summary:set.type==="quotes"?[item.author,item.work].filter(Boolean).join(" · "):item.content;
  const url="/library/?q="+encodeURIComponent(set.type==="quotes"?item.author||item.work||"":item.topic||item.title||"");
  const row=el("div",undefined,"morning-study-row"),type=el("span",kind,"morning-study-type"),body=el("div");
  body.append(internal(url,short(title,80)),el("small",short(summary,120)||"打开知识库继续学习"));
  row.append(type,body);box.append(row);
 }
}
function placeSocial(main){
 // Personal recommendations are the primary homepage content, never hidden at the bottom.
 const social=main.querySelector("#personal-recommendations")||main.querySelector("#social-recommendations");
 const header=main.querySelector(":scope > header");
 if(!social||!header)return;
 const hiddenWrapper=main.querySelector("#morning-social");
 if(hiddenWrapper)hiddenWrapper.replaceWith(social);
 header.insertAdjacentElement("afterend",social);
}
function ready(){
 if(!["/","/index.html"].includes(location.pathname))return;
 const main=document.querySelector("body.site-news main");if(!main||document.getElementById("morning-highlights"))return;
 const header=main.querySelector(":scope > header");if(!header)return;
 buildNav(header,main);
 highlights(main,reportData(main));
 createUpdates(main);
 wrapOverview(main);
 placeSocial(main);
 const sections=[...main.querySelectorAll(":scope > section.report")];
 if(sections.length){const anchor=el("div",undefined,"morning-reports-heading");anchor.id="morning-reports";anchor.append(el("span","FULL REPORT · 逐条回看","overline"),el("h2","新闻联播 · 逐条内容"));main.insertBefore(anchor,sections[0]);const controls=main.querySelector(":scope > .news-actions");if(controls)anchor.after(controls);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready();
})();