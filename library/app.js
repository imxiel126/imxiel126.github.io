(()=>{"use strict";
const paths={books:"data/books.json",quotes:"data/quotes.json",insights:"data/insights.json"};
const names={books:"书籍导读",quotes:"名言诗句",insights:"知识卡片"};
const byId=id=>document.getElementById(id);
const state={all:[],type:"all",category:"all",query:"",onlyFav:false,page:1,perPage:20,dailyShift:0};
let saved;try{saved=new Set(JSON.parse(localStorage.getItem("learning-favorites")||"[]"));}catch(e){saved=new Set();}
function persist(){try{localStorage.setItem("learning-favorites",JSON.stringify([...saved]));}catch(e){}}
function text(tag,content,cls){const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=content||"";return el;}
function dayInChina(){const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const get=k=>parts.find(x=>x.type===k).value;return [get("year"),get("month"),get("day")].join("-");}
function serialDay(date){return Math.floor(Date.parse(date+"T00:00:00Z")/86400000);}
function preview(x){return x.kind==="quotes"?x.content:(x.summary&&x.verifiedSummary?x.summary:x.kind==="books"?(x.guide||x.summary):x.content);}
function meta(x){return x.kind==="books"?(x.author||"作者未列")+(x.period?" · "+x.period:""):x.kind==="quotes"?(x.author||"作者未列")+" · 《"+(x.work||"古籍")+"》":x.category+" · "+x.angle;}
function renderDaily(){const box=byId("daily-grid");box.replaceChildren();const serial=serialDay(dayInChina());byId("day-text").textContent=dayInChina()+" · 北京时间每天自动轮换，一书、一言、一思";
for(const [type,step] of [["books",0],["quotes",1],["insights",2]]){let list=state.all.filter(x=>x.kind===type);if(type==="books"){const withSummaries=list.filter(x=>x.verifiedSummary);if(withSummaries.length)list=withSummaries;}if(!list.length)continue;const idx=((serial*7+state.dailyShift*13+step*101)%list.length+list.length)%list.length,x=list[idx];const card=text("article","","daily-card");card.append(text("span",names[type],"card-tag"),text("h3",x.kind==="quotes"?x.content:x.title),text("div",meta(x),"meta"));card.append(text("p",preview(x)));const b=text("button","展开研读","btn secondary");b.type="button";b.addEventListener("click",()=>openDetail(x));card.append(b);box.append(card);}}
function updateCategories(){const cats=new Set(state.all.filter(x=>state.type==="all"||x.kind===state.type).map(x=>x.category||x.type).filter(Boolean));const select=byId("category");select.replaceChildren(new Option("全部主题","all"));[...cats].sort((a,b)=>a.localeCompare(b,"zh-CN")).forEach(c=>select.add(new Option(c,c)));if(!cats.has(state.category))state.category="all";select.value=state.category;}
function matches(x){if(state.type!=="all"&&state.type!==x.kind)return false;if(state.category!=="all"&&(x.category||x.type)!==state.category)return false;if(state.onlyFav&&!saved.has(x.kind+":"+x.id))return false;if(!state.query)return true;const hay=[x.title,x.topic,x.author,x.work,x.content,x.summary,x.guide,x.category,x.angle,x.core].filter(Boolean).join(" ").toLocaleLowerCase();return state.query.split(/\s+/).every(w=>hay.includes(w));}
function renderItem(x){const card=text("article","","item");const row=text("div","","row");row.append(text("span",names[x.kind],"tag"));if(x.kind==="books")row.append(text("span",x.verifiedSummary?"已撰写摘要":"待精读",x.verifiedSummary?"tag":"tag soft"));card.append(row,text("h3",x.kind==="quotes"?x.content:x.title),text("small",meta(x)),text("p",preview(x)));const actions=text("div","","actions"),detail=text("button","查看详情 →","linkbutton"),fav=text("button",saved.has(x.kind+":"+x.id)?"★ 已收藏":"☆ 收藏","fav"+(saved.has(x.kind+":"+x.id)?" saved":""));detail.type="button";fav.type="button";detail.addEventListener("click",()=>openDetail(x));fav.addEventListener("click",()=>{toggleFavorite(x);render();});actions.append(detail,fav);card.append(actions);return card;}
function render(){const filtered=state.all.filter(matches);const maxPage=Math.max(1,Math.ceil(filtered.length/state.perPage));state.page=Math.min(state.page,maxPage);byId("result-count").textContent="找到 "+filtered.length.toLocaleString("zh-CN")+" 条内容 · 第 "+state.page+"/"+maxPage+" 页";const area=byId("results");area.replaceChildren();const slice=filtered.slice((state.page-1)*state.perPage,state.page*state.perPage);if(!slice.length){area.append(text("div","没有匹配的内容。可以调整关键词、主题或收藏筛选。","noresults"));}else slice.forEach(x=>area.append(renderItem(x)));const pg=byId("pages");pg.replaceChildren();const prev=text("button","上一页");prev.disabled=state.page===1;prev.addEventListener("click",()=>setPage(state.page-1));const next=text("button","下一页");next.disabled=state.page>=maxPage;next.addEventListener("click",()=>setPage(state.page+1));pg.append(prev,text("span",state.page+" / "+maxPage),next);}
function setPage(n){state.page=n;render();byId("browse").scrollIntoView({block:"start"});}
function toggleFavorite(x){const key=x.kind+":"+x.id;if(saved.has(key))saved.delete(key);else saved.add(key);persist();}
let active=null;
function openDetail(x){active=x;byId("modal-tag").textContent=names[x.kind];byId("modal-title").textContent=x.kind==="quotes"?x.content:x.title;byId("modal-meta").textContent=meta(x);byId("modal-body").textContent=preview(x);byId("modal-note").textContent=x.kind==="books"?(x.verifiedSummary?"原创概述，仅供快速理解；准确观点请核对原书。":"该条尚未撰写可信的逐书摘要，以上仅是通用阅读提示。"):x.kind==="quotes"?(x.source||"引用时请核原典。"):(x.source||"原创学习提示。");const dest=byId("modal-link");dest.replaceChildren();if(x.sourceUrl&&/^https:\/\//.test(x.sourceUrl)){const a=text("a","查看来源 ↗");a.href=x.sourceUrl;a.target="_blank";a.rel="noopener noreferrer";dest.append(a);}byId("modal-fav").textContent=saved.has(x.kind+":"+x.id)?"取消收藏":"收藏这条";
let hasReview=false;try{hasReview=JSON.parse(localStorage.getItem("zhixing-review-v1")||"[]").some(row=>row.key===x.kind+":"+x.id);}catch(e){}
byId("modal-review").textContent=hasReview?"已在复习计划中":"加入复习";
byId("modal-review").disabled=hasReview;
byId("detail").showModal();}
byId("modal-fav").addEventListener("click",()=>{if(active){toggleFavorite(active);byId("modal-fav").textContent=saved.has(active.kind+":"+active.id)?"取消收藏":"收藏这条";render();}});
byId("modal-review").addEventListener("click",()=>{
 if(!active)return;
 try{
  const key=active.kind+":"+active.id,storage="zhixing-review-v1";
  const items=JSON.parse(localStorage.getItem(storage)||"[]");
  if(!Array.isArray(items))throw Error("Invalid review queue");
  if(items.some(item=>item.key===key)){byId("modal-review").disabled=true;byId("modal-review").textContent="已在复习计划中";return;}
  const pts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const field=t=>pts.find(p=>p.type===t)?.value||"";
  const today=[field("year"),field("month"),field("day")].join("-");
  const due=new Date(Date.parse(today+"T00:00:00Z")+86400000).toISOString().slice(0,10);
  const title=active.kind==="quotes"?active.content:active.title;
  const query=active.kind==="quotes"?(active.author||active.work):active.topic||active.title;
  items.unshift({key,title:String(title||"").slice(0,220),desc:String(preview(active)||"").slice(0,260),url:"/library/?q="+encodeURIComponent(query||""),source:"知识库",stage:0,due,added:today});
  localStorage.setItem(storage,JSON.stringify(items.slice(0,300)));
  byId("modal-review").disabled=true;byId("modal-review").textContent="已加入复习";
 }catch(e){byId("modal-review").textContent="保存失败，请检查浏览器存储";}
});
byId("close").addEventListener("click",()=>byId("detail").close());
byId("detail").addEventListener("click",e=>{if(e.target===byId("detail"))byId("detail").close();});
let timer;byId("search").addEventListener("input",e=>{clearTimeout(timer);timer=setTimeout(()=>{state.query=e.target.value.trim().toLocaleLowerCase();state.page=1;render();},120);});
byId("type-tabs").addEventListener("click",e=>{const btn=e.target.closest("button[data-type]");if(!btn)return;state.type=btn.dataset.type;state.category="all";state.page=1;document.querySelectorAll(".tab[data-type]").forEach(b=>b.setAttribute("aria-pressed",String(b===btn)));updateCategories();render();});
byId("category").addEventListener("change",e=>{state.category=e.target.value;state.page=1;render();});
byId("favorites-only").addEventListener("change",e=>{state.onlyFav=e.target.checked;state.page=1;render();});
byId("next-daily").addEventListener("click",()=>{state.dailyShift++;renderDaily();});
Promise.all(Object.entries(paths).map(async([kind,path])=>{const r=await fetch(path,{cache:"no-cache"});if(!r.ok)throw Error(kind+" HTTP "+r.status);const d=await r.json();if(!Array.isArray(d.items))throw Error(kind+" 格式异常");return d.items.map(x=>({...x,kind}));})).then(groups=>{state.all=[];const longest=Math.max(...groups.map(g=>g.length));for(let i=0;i<longest;i++)for(const group of groups)if(group[i])state.all.push(group[i]);const counts=Object.keys(paths).map(kind=>state.all.filter(x=>x.kind===kind).length);["books","quotes","insights"].forEach((k,i)=>byId("stat-"+k).textContent=counts[i].toLocaleString("zh-CN"));byId("stat-total").textContent=state.all.length.toLocaleString("zh-CN");byId("status").textContent="资料加载完成";const q=new URLSearchParams(location.search).get("q");if(q){byId("search").value=q;state.query=q.toLowerCase();}updateCategories();renderDaily();render();}).catch(e=>{byId("status").textContent="资料加载失败，请刷新重试";byId("daily-grid").textContent="暂时无法加载学习内容。";byId("results").textContent="加载失败："+e.message;});
})();