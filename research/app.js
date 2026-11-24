(()=>{"use strict";
const $=id=>document.getElementById(id), names={hydrogen:"氢能",papers:"前沿论文",energy:"能源科技",policy:"政策与标准"};
const state={items:[],filter:"hydrogen",search:"",shown:8};
const node=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);if(cls)n.className=cls;return n;};
const safeUrl=(raw,allow)=>{try{const u=new URL(raw);if(u.protocol!=="https:")return"";if(allow==="doi"&&u.hostname!=="doi.org")return"";if(allow==="blog"&&(u.hostname!=="xie-l.github.io"))return"";return u.href;}catch{return"";}};
const trim=(value,limit)=>{const s=String(value||"").trim();return s.length>limit?s.slice(0,limit)+"…":s;};
const sourceLink=(url,label,restriction)=>{const href=safeUrl(url,restriction);if(!href)return null;const a=node("a",label,"research-link");a.href=href;a.target="_blank";a.rel="noopener noreferrer";return a;};
const count=n=>Number.isFinite(Number(n))?Number(n).toLocaleString("zh-CN"):"—";
function metrics(a){
const root=$("research-metrics");root.replaceChildren();
const entries=[["索引论文",count(a.paper_count),"篇"],["索引引用",count(a.citation_count),"次"],["h-index",count(a.h_index),""]];
for(const [k,v,unit] of entries){const card=node("div",undefined,"research-metric");card.append(node("b",v),node("span",k+(unit?" · "+unit:"")));root.append(card);}
$("paper-source").textContent=(a.author_name||"")+(a.updated?" · 数据 "+a.updated:"");
const list=$("paper-list");list.replaceChildren();let papers=Array.isArray(a.papers)?a.papers:[];
if(!papers.length){list.append(node("p","暂未同步到学术论文记录。","research-placeholder"));return;}
papers.forEach((p,i)=>{const article=node("article",undefined,"research-paper"),id=node("span",String(i+1).padStart(2,"0"),"research-index");const body=node("div",undefined,"research-paper-body"),h=node("h4",p.title||"未命名论文"),meta=node("p",[p.venue,p.year].filter(Boolean).join(" · "),"research-meta");body.append(h,meta);if(Number.isFinite(Number(p.citations)))body.append(node("span",String(p.citations)+" 次索引引用","research-citations"));if(p.doi){const link=sourceLink("https://doi.org/"+p.doi,"查看 DOI ↗","doi");if(link)body.append(link);}article.append(id,body);list.append(article);});}
function filteredNews(){return state.items.filter(x=>(state.filter==="all"||x.type===state.filter)&&(!state.search||[x.title,x.summary,x.source,x.type].join(" ").toLocaleLowerCase().includes(state.search)));}
function renderNews(){const root=$("research-feed"),more=$("research-more");root.replaceChildren();more.replaceChildren();const all=filteredNews();if(!all.length){root.append(node("p","暂无匹配的研究动态。","research-placeholder"));return;}
for(const x of all.slice(0,state.shown)){const article=node("article",undefined,"research-news-row"),details=node("div",undefined,"research-news-body"),head=node("div",undefined,"research-news-heading"),category=node("span",names[x.type]||"资讯","research-news-tag"),date=node("time",x.date||"","research-meta");head.append(category,date);const h=node("h3",trim(x.title,150)),p=node("p",trim(x.summary,260)),bottom=node("div",undefined,"research-news-footer");bottom.append(node("small",x.source||"公开资料源"));const link=sourceLink(x.url,"阅读来源 ↗");if(link)bottom.append(link);
 if(link){
  const save=node("button","＋ 稍后读","research-save-later");
  save.type="button";
  save.addEventListener("click",()=>{
   try{
    const storeKey="zhixing-queue-v1",items=JSON.parse(localStorage.getItem(storeKey)||"[]");
    if(!Array.isArray(items))throw Error("Invalid queue");
    if(items.some(r=>r.url===link.href)){save.textContent="已保存";save.disabled=true;return;}
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const value=k=>parts.find(part=>part.type===k)?.value||"";
    items.unshift({url:link.href,title:String(x.title||"").slice(0,160),source:"研究资讯",saved:[value("year"),value("month"),value("day")].join("-")});
    localStorage.setItem(storeKey,JSON.stringify(items.slice(0,200)));
    save.textContent="已保存";save.disabled=true;
   }catch(e){save.textContent="保存失败";}
  });
  bottom.append(save);
  const capture=node("button","＋ 收入第二大脑","research-save-later");capture.type="button";
  capture.addEventListener("click",()=>{
   const out=window.ZhixingBrain?.capture({text:x.title+"\n"+trim(x.summary,400),url:x.url,source:x.source||"研究资讯",kind:"source"});
   capture.textContent=out?.ok?(out.duplicate?"已收集":"已入收集箱"):(out?.reason||"暂时无法保存");
   if(out?.ok)capture.disabled=true;
  });
  bottom.append(capture);
 }
 details.append(head,h,p,bottom);article.append(details);root.append(article);}
if(all.length>state.shown){const b=node("button","继续查看（剩余 "+(all.length-state.shown)+" 条）","research-show-more");b.type="button";b.addEventListener("click",()=>{state.shown+=8;renderNews();});more.append(b);}}
function writing(list){const root=$("research-writing");root.replaceChildren();if(!list.length){root.append(node("p","当前没有可展示的公开技术文章。","research-placeholder"));return;}
list.slice(0,12).forEach(x=>{const article=node("article",undefined,"research-writing-row"),head=node("div",undefined,"research-writing-head");head.append(node("span",x.category==="analysis"?"研究分析":"技术笔记","research-news-tag"),node("time",x.date||"","research-meta"));article.append(head,node("h3",x.title),node("p",trim(x.summary,240)));const link=sourceLink(x.url,"查阅原站全文 ↗","blog");if(link)article.append(link);root.append(article);});}
function init(data){
const a=data.academic||{}, news=Array.isArray(data.news)?data.news:[],articles=Array.isArray(data.writing)?data.writing:[];
const stamp=data.synced_at?new Date(data.synced_at):null;
$("sync-status").textContent=stamp&&!Number.isNaN(stamp.getTime())?"公开资料内容更新 · "+new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(stamp):"已载入公开研究资料";
metrics(a);state.items=news;renderNews();writing(articles);
}
$("research-tabs").addEventListener("click",event=>{const b=event.target.closest("button[data-type]");if(!b)return;state.filter=b.dataset.type;state.shown=8;document.querySelectorAll(".research-tab").forEach(x=>{const active=x===b;x.classList.toggle("active",active);x.setAttribute("aria-pressed",String(active));});renderNews();});
let queryTimer;
$("research-search").addEventListener("input",event=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>{state.search=event.target.value.trim().toLocaleLowerCase();state.shown=8;renderNews();},150);});
fetch("/research/data.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();}).then(data=>{if(!data||!data.academic||!Array.isArray(data.news))throw Error("Invalid research data");init(data);}).catch(()=>{$("sync-status").textContent="研究资料暂未加载，页面可稍后刷新";$("paper-list").textContent="暂无可用数据";$("research-feed").textContent="研究动态暂不可用";$("research-writing").textContent="技术文章暂不可用";});
})();