/* 知行手记 — local-first Second Brain. All private data stays in this browser. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const make=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined&&value!==null)e.textContent=String(value);if(cls)e.className=cls;return e;};
const STORE="zhixing-brain-v1",LEARN={days:"zhixing-days-v1",reviews:"zhixing-review-v1",queue:"zhixing-queue-v1",favorites:"learning-favorites"};
const AREAS=["计量与检测","氢能与能源","生态环境","科研与转化","AI与编程","阅读与写作","工作与项目","生活与成长","其他"];
const LABELS={idea:"灵感",question:"问题",source:"资料",action:"待办"};
const data=loadBrain();
const SEARCH={public:[],status:"idle",term:"",scope:"all",shown:20,matches:[],wait:null};
let currentTab="inbox", editingNote=null,pendingInbox=null, ascending=false,notesFilter="all";
function str(x,max=2000){return String(x===null||x===undefined?"":x).trim().slice(0,max);}
function validUrl(s){try{const u=new URL(s);return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.href:"";}catch{return"";}}
function localGet(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch{return fallback;}}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(data));return true;}catch(e){$("brain-backup-status").textContent="保存失败：浏览器空间不足或禁止存储。请尽快导出备份。";return false;}}
function loadBrain(){const v=localGet(STORE,null);const empty={version:1,inbox:[],notes:[],projects:[],tasks:[],weeks:{}};if(!v||typeof v!=="object"||Array.isArray(v))return empty;for(const k of ["inbox","notes","projects","tasks"])if(!Array.isArray(v[k]))v[k]=[];if(!v.weeks||typeof v.weeks!=="object"||Array.isArray(v.weeks))v.weeks={};return v;}
function id(){return (globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():"b"+Date.now().toString(36)+Math.random().toString(36).slice(2));}
function day(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),v=k=>p.find(x=>x.type===k)?.value||"";return[v("year"),v("month"),v("day")].join("-");}
function addDays(date,n){const t=Date.parse(date+"T00:00:00Z");return Number.isFinite(t)?new Date(t+n*86400000).toISOString().slice(0,10):day();}
function now(){return new Date().toISOString();}
function short(t,n=140){const s=str(t,n+30);return s.length>n?s.slice(0,n)+"…":s;}
function dtime(s){if(!s)return"";if(typeof s==="number"&&s>=1800&&s<=2200)return String(s);if(typeof s==="string"&&/^\d{4}$/.test(s))return s;const d=new Date(s);return Number.isNaN(d.getTime())?str(s,24):new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit"}).format(d);}
function escapedQuery(s){return encodeURIComponent(str(s,90));}
function tag(label){return make("span",label,"brain-item-label");}
function link(url,text){const a=make("a",text);const raw=str(url,1800);if(raw.startsWith("/")&&!raw.startsWith("//")){a.href=raw;return a;}const safe=validUrl(raw);a.href=safe||"/brain/";if(safe){a.target="_blank";a.rel="noopener noreferrer";}return a;}
function btn(title,handler,danger){const b=make("button",title,danger?"danger":"");b.type="button";b.addEventListener("click",handler);return b;}
function actions(...items){const box=make("div",undefined,"brain-item-actions");for(const b of items)if(b)box.append(b);return box;}
function empty(text){return make("p",text,"brain-empty");}
function weekKey(date=day()){const d=new Date(date+"T00:00:00Z");const weekday=(d.getUTCDay()+6)%7;return addDays(date,-weekday);}
function show(tab){currentTab=tab;for(const b of document.querySelectorAll(".brain-tabs button[data-tab]")){const on=b.dataset.tab===tab;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on));}for(const key of ["inbox","notes","projects","search","weekly"])$("panel-"+key).hidden=tab!==key;
if(tab==="search")renderSearch();if(tab==="weekly")renderWeek();if(tab==="projects")renderProjects();if(tab==="notes")renderNotes();}
function counts(){const active=data.projects.filter(p=>p.status!=="archived");const open=data.tasks.filter(t=>!t.done);$("brain-count-inbox").textContent=data.inbox.filter(x=>!x.deferUntil||x.deferUntil<=day()).length;
$("inbox-tab-count").textContent=data.inbox.length;$("brain-count-notes").textContent=data.notes.length;$("brain-count-projects").textContent=active.length;
$("brain-count-tasks").textContent=open.length;}
function refresh(){counts();renderInbox();renderNotes();renderProjects();if(currentTab==="search")renderSearch();if(currentTab==="weekly")renderWeek();}
function saveCapture(evt){evt.preventDefault();const content=str($("capture-content").value,4000),source=str($("capture-url").value,1500);if(!content)return;
if(source&&!validUrl(source)){$("capture-status").textContent="来源需是有效的 http(s) 链接";return;}
if(data.inbox.length>=500){$("capture-status").textContent="收集箱已达500条，请先整理或导出。";return;}
data.inbox.unshift({id:id(),type:$("capture-kind").value,text:content,url:source?validUrl(source):"",created:now(),deferUntil:""});
if(!persist())return;$("capture-form").reset();$("capture-status").textContent="已存入收集箱，稍后再整理。";refresh();show("inbox");}
function renderInbox(){const root=$("brain-inbox-list");root.replaceChildren();const today=day(),future=data.inbox.filter(x=>x.deferUntil&&x.deferUntil>today),sorted=data.inbox.filter(x=>!x.deferUntil||x.deferUntil<=today).sort((a,b)=>ascending?String(a.created).localeCompare(b.created):String(b.created).localeCompare(a.created));
if(future.length)root.append(make("p",future.length+" 条内容已延后处理，到期后会重新显示。","brain-caption"));
if(!sorted.length){root.append(empty(future.length?"今日没有待处理的收集内容。":"收集箱清空了。今天看到什么问题或灵感，可直接记录到上方。"));return;}
sorted.forEach(x=>{const card=make("article",undefined,"brain-item"),h=make("div",undefined,"brain-item-header");
h.append(tag(LABELS[x.type]||"记录"),make("time",dtime(x.created)+(x.deferUntil&&x.deferUntil>today?" · "+x.deferUntil+"再看":"")));
card.append(h,make("p",short(x.text,400)));if(x.url)card.append(link(x.url,"查看原始来源 ↗"));
const opts=actions(btn("写成知识笔记",()=>openNote(x)),btn("变成下一步行动",()=>convertTask(x)),btn("一周后再看",()=>{x.deferUntil=addDays(day(),7);if(persist())refresh();}),btn("删除",()=>{if(!confirm("确定删除这条未整理的收集吗？"))return;data.inbox=data.inbox.filter(a=>a.id!==x.id);if(persist())refresh();},true));
card.append(opts);root.append(card);});}
function convertTask(x){const project="";if(data.tasks.length>=1500){alert("待办已达到容量限制，请整理或导出。");return;}
data.tasks.unshift({id:id(),title:short(x.text,240),detail:str(x.text,2000),projectId:project,due:"",done:false,created:now(),completed:""});
data.inbox=data.inbox.filter(r=>r.id!==x.id);if(persist()){refresh();show("projects");$("task-title").focus();}}
function fillAreas(id,first){const select=$(id);select.replaceChildren();if(first)select.add(new Option("全部主题","all"));for(const a of AREAS)select.add(new Option(a,a));}
function projectOptions(){const allowed=data.projects.filter(x=>x.status!=="archived");for(const id of ["note-project","task-project"]){const select=$(id),old=select.value;select.replaceChildren(new Option("不关联项目",""));for(const p of allowed)select.add(new Option(p.name,p.id));select.value=allowed.some(x=>x.id===old)?old:"";}}
function openNote(inbox=null,note=null){editingNote=note?.id||null;pendingInbox=inbox?.id||null;const form=$("note-form");form.hidden=false;$("note-title").value=note?.title||short((inbox?.text||"").split("\n")[0],180);
$("note-area").value=note?.area||"其他";projectOptions();$("note-project").value=note?.projectId||"";$("note-explain").value=note?.explain||inbox?.text||"";$("note-question").value=note?.question||"";$("note-source").value=note?.source||inbox?.url||"";$("note-apply").value=note?.apply||"";$("note-tags").value=(note?.tags||[]).join(", ");$("note-review").checked=!note;
$("note-form-state").textContent=inbox?"已从收集箱带入内容；保存后再移除原记录。":"先写自己的解释，再保存。";show("notes");form.scrollIntoView({block:"start",behavior:"smooth"});$("note-title").focus();}
function closeNote(){$("note-form").hidden=true;editingNote=null;pendingInbox=null;$("note-form").reset();}
function submitNote(evt){evt.preventDefault();const title=str($("note-title").value,180);if(!title)return;
if(!editingNote&&data.notes.length>=1500){$("note-form-state").textContent="笔记已达到容量限制，请先导出和整理。";return;}
const obj={title,area:$("note-area").value,projectId:$("note-project").value,explain:str($("note-explain").value,8000),question:str($("note-question").value,400),source:str($("note-source").value,2000),apply:str($("note-apply").value,2000),tags:[...new Set($("note-tags").value.split(/[,，、]/).map(x=>str(x,35)).filter(Boolean))].slice(0,12),updated:now()};
let note;if(editingNote){note=data.notes.find(x=>x.id===editingNote);if(!note)return;Object.assign(note,obj);}else{note={id:id(),created:now(),...obj};data.notes.unshift(note);}
if(!persist())return;
if(pendingInbox){data.inbox=data.inbox.filter(x=>x.id!==pendingInbox);persist();}
if($("note-review").checked)addReviewFromNote(note);closeNote();refresh();$("brain-backup-status").textContent="知识笔记已保存。";}
function addReviewFromNote(note){const storageKey=LEARN.reviews,arr=localGet(storageKey,[]);if(!Array.isArray(arr))return;
const key="brain:"+note.id;if(arr.some(x=>x.key===key))return;arr.unshift({key,title:short(note.title,220),desc:short(note.question?"回忆问题："+note.question:"不看原文，请试着解释："+note.title,260),url:"/brain/?note="+encodeURIComponent(note.id),source:"第二大脑",stage:0,due:addDays(day(),1),added:day()});
try{localStorage.setItem(storageKey,JSON.stringify(arr.slice(0,300)));}catch(e){$("brain-backup-status").textContent="笔记已保存，但浏览器空间不足，未能加入复习。";}}
function renderNotes(){const root=$("brain-note-list");root.replaceChildren();const list=data.notes.filter(n=>notesFilter==="all"||n.area===notesFilter);$("notes-count").textContent="共 "+list.length+" 篇知识笔记";
if(!list.length){root.append(empty("这里还没有对应主题的知识笔记。从收集箱选一条，再用自己的话解释。"));return;}
for(const x of list.slice(0,200)){const a=make("article",undefined,"brain-item");a.id="brain-note-"+x.id;const top=make("div",undefined,"brain-item-header");top.append(tag(x.area||"未分类"),make("time",dtime(x.updated)));a.append(top,make("h3",x.title));if(x.explain)a.append(make("p",short(x.explain,470)));
if(x.question)a.append(make("p","自测问题："+short(x.question,240)));
if(x.source)a.append(make("p","证据/来源："+short(x.source,170)));if(x.apply)a.append(make("p","如何使用："+short(x.apply,170)));
const tags=make("div",undefined,"brain-tag-list");(x.tags||[]).forEach(t=>tags.append(make("span",t)));a.append(tags);
const project=data.projects.find(p=>p.id===x.projectId);if(project)a.append(make("small","关联项目："+project.name));
a.append(actions(btn("编辑与完善",()=>openNote(null,x)),btn("加入复习",()=>{addReviewFromNote(x);$("brain-backup-status").textContent="已加入学习台间隔复习计划。";}),btn("搜索相关",()=>{selectSearch(x.title);}),btn("删除",()=>{if(!confirm("删除这条笔记？该操作不可撤销，建议先备份。"))return;data.notes=data.notes.filter(n=>n.id!==x.id);if(persist())refresh();},true)));
root.append(a);}
if(list.length>200)root.append(make("p","显示前200篇，可使用全域搜索找其他笔记。","brain-caption"));}
function newProject(evt){evt.preventDefault();if(data.projects.length>=200){alert("项目数量过多，请先归档。");return;}
const name=str($("project-name").value,160);if(!name)return;
const project={id:id(),name,area:$("project-area").value,outcome:str($("project-outcome").value,2000),deadline:$("project-deadline").value,status:"active",created:now()};
data.projects.unshift(project);const first=str($("project-first").value,240);if(first)data.tasks.unshift({id:id(),title:first,detail:"",projectId:project.id,due:"",done:false,created:now(),completed:""});
if(!persist())return;$("project-form").reset();$("project-form").hidden=true;refresh();}
function submitTask(evt){evt.preventDefault();const title=str($("task-title").value,240);if(!title)return;if(data.tasks.length>=1500){alert("待办任务已达到容量限制");return;}
data.tasks.unshift({id:id(),title,detail:"",projectId:$("task-project").value,due:$("task-due").value,trigger:str($("task-trigger").value,160),done:false,created:now(),completed:""});if(!persist())return;
$("task-form").reset();refresh();}
function renderProjects(){projectOptions();const root=$("brain-project-list");root.replaceChildren();const filter=$("project-view").value,projects=data.projects.filter(p=>filter==="all"||(filter==="active"?p.status!=="archived":p.status==="archived"));
if(!projects.length)root.append(empty("尚无项目。可以从一个明确成果开始，不必先制订完美计划。"));
for(const p of projects){const tasks=data.tasks.filter(t=>t.projectId===p.id),open=tasks.filter(t=>!t.done),next=open[0];const article=make("article",undefined,"brain-project-card"),header=make("div",undefined,"brain-item-header");header.append(make("h3",p.name),tag(p.status==="archived"?"已归档":p.area));article.append(header);
if(p.outcome)article.append(make("p","目标："+short(p.outcome,180)));if(next)article.append(make("p","下一步："+next.title,"brain-project-next"));else article.append(make("p","暂无下一步动作，可添加一项能直接开始的行动。"));
article.append(make("small",tasks.filter(x=>x.done).length+"/"+tasks.length+" 项行动完成"+(p.deadline?" · 目标 "+p.deadline:"")+" · 关联笔记 "+data.notes.filter(n=>n.projectId===p.id).length+" 篇"));
article.append(actions(btn("添加下一步",()=>{show("projects");$("task-project").value=p.id;$("task-title").focus();}),btn(p.status==="archived"?"重新激活":"归档项目",()=>{p.status=p.status==="archived"?"active":"archived";if(persist())refresh();})));
root.append(article);}
const taskHost=$("brain-task-list");taskHost.replaceChildren();const unfinished=data.tasks.filter(t=>!t.done).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999")||String(a.created).localeCompare(b.created));
if(!unfinished.length)taskHost.append(empty("没有待执行的行动。每个重要项目建议保留一个明确的下一步。"));
for(const x of unfinished.slice(0,100)){const row=make("article",undefined,"brain-item");row.append(make("h3",x.title));const p=data.projects.find(p=>p.id===x.projectId),hint=make("small",(p?p.name+" · ":"")+(x.due?"截止 "+x.due:"未设期限"),"brain-task-due"+(x.due&&x.due<day()?" late":""));row.append(hint);
if(x.detail)row.append(make("p",short(x.detail,300)));
if(x.trigger)row.append(make("p","当 "+short(x.trigger,130)+"，我就 "+short(x.title,155),"brain-project-next"));
row.append(actions(btn("标记完成",()=>{x.done=true;x.completed=now();if(persist())refresh();}),btn("删除",()=>{if(!confirm("删除这项行动？"))return;data.tasks=data.tasks.filter(t=>t.id!==x.id);if(persist())refresh();},true)));taskHost.append(row);}
if(unfinished.length>100)taskHost.append(make("p","当前只展示前100项行动，建议先整理项目。","brain-caption"));}
function weekOverview(){const since=weekKey(),done=data.tasks.filter(t=>t.done&&t.completed?.slice(0,10)>=since).length,notes=data.notes.filter(n=>n.created?.slice(0,10)>=since).length,stale=data.inbox.filter(i=>i.created?.slice(0,10)<addDays(day(),-7)).length;return[[notes,"本周新增知识笔记"],[done,"本周完成行动"],[stale,"超过7天未整理"]];}
function renderWeek(){const week=weekKey(),entry=data.weeks[week]||{};$("week-label").textContent="本周起始 "+week;
$("week-insight").value=entry.insight||"";$("week-blocker").value=entry.blocker||"";$("week-next").value=entry.next||"";
const box=$("brain-week-overview");box.replaceChildren();weekOverview().forEach(([n,label])=>{const e=make("div");e.append(make("strong",n),make("span",label));box.append(e);});
const hist=$("week-history");hist.replaceChildren();const keys=Object.keys(data.weeks).sort().reverse();
if(!keys.length)hist.append(empty("本周完成第一条复盘后，这里会保留历史记录。"));
keys.slice(0,12).forEach(k=>{const w=data.weeks[k],a=make("article");a.append(make("h4","周起始 "+k),make("p","收获："+short(w.insight,350)),make("p","阻碍："+short(w.blocker,250)),make("p","下一步："+short(w.next,250)));hist.append(a);});}
function storeWeek(evt){evt.preventDefault();const key=weekKey();data.weeks[key]={insight:str($("week-insight").value,3000),blocker:str($("week-blocker").value,3000),next:str($("week-next").value,3000),updated:now()};
const keys=Object.keys(data.weeks).sort();for(const k of keys.slice(0,Math.max(0,keys.length-156)))delete data.weeks[k];if(persist()){$("week-status").textContent="本周复盘已保存";renderWeek();}}
function localRecords(){const rows=[];for(const x of data.notes)rows.push({scope:"personal",kind:"笔记",title:x.title,desc:[x.explain,x.source,x.apply].join(" "),tag:x.area||"",url:"/brain/?note="+encodeURIComponent(x.id),date:x.updated,source:"个人知识笔记"});
for(const x of data.inbox)rows.push({scope:"personal",kind:"收集",title:short(x.text,115),desc:x.text,tag:LABELS[x.type],url:"/brain/?inbox="+encodeURIComponent(x.id),date:x.created,source:"收集箱"});
for(const x of data.projects)rows.push({scope:"personal",kind:"项目",title:x.name,desc:x.outcome,tag:x.area,url:"/brain/?tab=projects",date:x.created,source:"项目目标"});
for(const x of data.tasks)rows.push({scope:"personal",kind:"行动",title:x.title,desc:x.detail,tag:x.done?"已完成":"待处理",url:"/brain/?tab=projects",date:x.created,source:"行动清单"});
for(const x of (localGet(LEARN.queue,[])||[]))if(x&&x.title&&validUrl(x.url))rows.push({scope:"personal",kind:"待读",title:x.title,desc:x.url,tag:x.source||"",url:x.url,date:x.saved,source:"稍后阅读"});
const days=localGet(LEARN.days,{});if(days&&typeof days==="object")for(const [dt,r] of Object.entries(days)){if(r&&r.note)rows.push({scope:"personal",kind:"日记",title:dt+" 学习记录",desc:str(r.note,12000),tag:str(r.question,220),url:"/learn/",date:dt,source:"个人学习台"});}
for(const [wk,r] of Object.entries(data.weeks))rows.push({scope:"personal",kind:"复盘",title:wk+" 周复盘",desc:[r.insight,r.blocker,r.next].join(" "),tag:"每周回顾",url:"/brain/?tab=weekly",date:wk,source:"个人复盘"});
return rows;}
function searchRecord(kind,title,desc,url,source,tag,scope,date){return{kind,title:str(title,300),desc:str(desc,1400),url,source,tag:str(tag,120),scope,date};}
const loaders=[
["/library/data/books.json",d=>(d.items||[]).map(x=>searchRecord("书籍",x.title,[x.author,x.summary,x.guide].join(" " ),"/library/?q="+escapedQuery(x.title),"书籍知识库",x.category,"library"))],
["/library/data/quotes.json",d=>(d.items||[]).map(x=>searchRecord("名言",short(x.content,125),[x.work,x.author,x.content].join(" "),"/library/?q="+escapedQuery(x.author||x.work),"经典名言",x.work,"library"))],
["/library/data/insights.json",d=>(d.items||[]).map(x=>searchRecord("知识卡",x.title,[x.topic,x.content,x.core].join(" "),"/library/?q="+escapedQuery(x.topic),"跨学科学习",x.category,"library"))],
["/reading/reflections-2000.json",d=>(d.cards||[]).map(x=>searchRecord("思考卡",x.title,[x.view,x.practice].join(" "),"/reading/#reading-reflections","阅读思考",x.category,"reading"))],
["/reading/data.json",d=>(d.books||[]).map(x=>searchRecord("书架",x.title,[x.author,x.category,x.summary,x.guide?.intro].join(" "),validUrl(x.link)||"/reading/","微信读书",x.category,"reading",d.updated))],
["/research/data.json",d=>[...(d.news||[]).map(x=>searchRecord("科研资讯",x.title,x.summary,validUrl(x.url)||"/research/",x.source,x.type,"research",x.date)),...(d.academic?.papers||[]).map(x=>searchRecord("论文",x.title,x.venue,x.doi?"https://doi.org/"+x.doi:"/research/","学术索引",x.year,"research")),...(d.writing||[]).map(x=>searchRecord("技术文章",x.title,x.summary,validUrl(x.url)||"/research/","研究札记",x.category,"research",x.date))]],
["/notes/data.json",d=>(d.items||[]).map(x=>searchRecord("公开笔记",x.title,[x.summary,x.excerpt].join(" "),"/notes/","公开笔记",x.tags?.join(" "), "research",x.date))]
];
function loadPublic(){if(SEARCH.status==="loading"||SEARCH.status==="ready")return SEARCH.wait||Promise.resolve();
SEARCH.status="loading";$("search-status").textContent="正在读取公开知识索引…";
SEARCH.wait=Promise.allSettled(loaders.map(async([url,parser])=>{const r=await fetch(url,{cache:"force-cache"});if(!r.ok)throw Error(url+" "+r.status);return parser(await r.json());})).then(results=>{
SEARCH.public=results.filter(x=>x.status==="fulfilled").flatMap(x=>x.value);
const failed=results.filter(x=>x.status!=="fulfilled").length;
SEARCH.status=failed?"partial":"ready";$("search-status").textContent="已索引 "+SEARCH.public.length.toLocaleString("zh-CN")+" 条公开资料"+(failed?" · 部分来源暂不可用":"");
renderSearch();});return SEARCH.wait;}
function scored(row,terms){const t=String(row.title||"").toLocaleLowerCase(),b=[row.desc,row.tag,row.source].join(" ").toLocaleLowerCase();
if(!terms.every(w=>t.includes(w)||b.includes(w)))return-1;
return terms.reduce((n,w)=>n+(t.includes(w)?9:0)+(String(row.tag||"").toLocaleLowerCase().includes(w)?4:0)+(b.includes(w)?1:0),0)+(row.scope==="personal"?12:0);
}
function renderSearch(){const root=$("brain-results");if(currentTab!=="search")return;const q=SEARCH.term.toLocaleLowerCase().trim(),scope=SEARCH.scope;
const rows=[...localRecords(),...SEARCH.public].filter(r=>scope==="all"||r.scope===scope||(scope==="personal"&&r.scope==="personal"));
const terms=q.split(/\s+/).filter(Boolean);SEARCH.matches=(terms.length?rows.map(r=>({r,score:scored(r,terms)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.r):rows.filter(x=>x.scope==="personal").slice(0,40));
root.replaceChildren();if(!SEARCH.matches.length){root.append(empty(q?"没有匹配项。换一个词，或继续加载公开资料。":"先输入关键词，或查看下面的个人知识与行动记录。"));}
for(const r of SEARCH.matches.slice(0,SEARCH.shown)){const item=make("article",undefined,"brain-search-result");
item.append(make("span",r.kind,"brain-result-kind"));const body=make("div",undefined,"brain-result-body"),heading=make("h3"),a=link(r.url,r.title);heading.append(a);body.append(heading);
if(r.desc)body.append(make("p",short(r.desc,245)));body.append(make("small",[r.source,r.tag,dtime(r.date)].filter(Boolean).join(" · ")));
if(r.scope!=="personal"){body.append(actions(btn("收集这条",()=>{if(data.inbox.length>=500){alert("收集箱已经满了");return;}
if(data.inbox.some(i=>i.url===r.url&&i.text===r.title))return;
data.inbox.unshift({id:id(),type:"source",text:r.title,url:validUrl(r.url)||"",created:now(),deferUntil:""});if(persist()){counts();$("search-status").textContent="已放入收集箱，稍后可加工成知识或行动。";}})));}
item.append(body);root.append(item);}
$("search-more").hidden=SEARCH.matches.length<=SEARCH.shown;if(SEARCH.status==="idle"||SEARCH.status==="loading")$("search-status").textContent=SEARCH.status==="idle"?"输入后自动加载公开资料":"正在读取公开资料…";}
function selectSearch(query){SEARCH.term=str(query,160);$("brain-search").value=SEARCH.term;SEARCH.shown=20;show("search");loadPublic();$("brain-results").scrollIntoView({block:"start",behavior:"smooth"});}
function searchSubmit(evt){evt.preventDefault();selectSearch($("brain-search").value);}
function backup(){const out={format:"zhixing-second-brain",version:2,exported_at:now(),brain:data,learning:{days:localGet(LEARN.days,{}),reviews:localGet(LEARN.reviews,[]),queue:localGet(LEARN.queue,[]),favorites:localGet(LEARN.favorites,[])}};
const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=make("a");a.href=url;a.download="知行手记-完整第二大脑备份-"+day()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);$("brain-backup-status").textContent="已生成本地备份，请妥善保存。备份中包含你的个人笔记。";}
function safeImport(o){if(!o||typeof o!=="object"||o.version!==2||o.format!=="zhixing-second-brain"||!o.brain)throw Error("不是有效的第二大脑备份");
const b=o.brain;if(!Array.isArray(b.inbox)||!Array.isArray(b.notes)||!Array.isArray(b.projects)||!Array.isArray(b.tasks)||!b.weeks||typeof b.weeks!=="object")throw Error("备份结构不完整");
if(b.inbox.length>500||b.notes.length>1500||b.projects.length>200||b.tasks.length>1500||Object.keys(b.weeks).length>156)throw Error("备份条目超过容量上限");
const seen=new Set();for(const part of [b.inbox,b.notes,b.projects,b.tasks])for(const e of part){if(!e||typeof e.id!=="string"||e.id.length>160||seen.has(e.id))throw Error("备份含无效或重复标识");seen.add(e.id);}
const cleanInbox=b.inbox.map(e=>({id:e.id,type:LABELS[e.type]?e.type:"idea",text:str(e.text,4000),url:validUrl(e.url),created:str(e.created,45),deferUntil:str(e.deferUntil,12)}));
const cleanNotes=b.notes.map(e=>({id:e.id,title:str(e.title,180),area:AREAS.includes(e.area)?e.area:"其他",explain:str(e.explain,8000),question:str(e.question,400),source:str(e.source,2000),apply:str(e.apply,2000),tags:Array.isArray(e.tags)?e.tags.slice(0,12).map(x=>str(x,35)):[],projectId:str(e.projectId,160),created:str(e.created,45),updated:str(e.updated,45)}));
const cleanProj=b.projects.map(e=>({id:e.id,name:str(e.name,160),area:AREAS.includes(e.area)?e.area:"其他",outcome:str(e.outcome,2000),deadline:str(e.deadline,12),status:e.status==="archived"?"archived":"active",created:str(e.created,45)}));
const cleanTasks=b.tasks.map(e=>({id:e.id,title:str(e.title,240),detail:str(e.detail,2000),projectId:str(e.projectId,160),due:str(e.due,12),trigger:str(e.trigger,160),done:e.done===true,created:str(e.created,45),completed:str(e.completed,45)}));
const weeks={};for(const [k,e] of Object.entries(b.weeks)){if(!/^\d{4}-\d\d-\d\d$/.test(k)||!e||typeof e!=="object")continue;weeks[k]={insight:str(e.insight,3000),blocker:str(e.blocker,3000),next:str(e.next,3000),updated:str(e.updated,45)};}
return{version:1,inbox:cleanInbox,notes:cleanNotes,projects:cleanProj,tasks:cleanTasks,weeks};}
async function importFile(evt){const file=evt.target.files?.[0];if(!file)return;try{if(file.size>7_000_000)throw Error("备份不能超过7 MB");
const parsed=JSON.parse(await file.text()),restored=safeImport(parsed);
if(!confirm("导入将覆盖当前浏览器的第二大脑、学习记录和稍后阅读。确认已备份现有数据并继续？"))return;
Object.assign(data,restored);if(!persist())throw Error("当前浏览器不能保存导入的数据");
const l=parsed.learning||{};for(const [name,key] of Object.entries(LEARN)){const v=l[name];if(name==="days"&&v&&typeof v==="object"&&!Array.isArray(v))localStorage.setItem(key,JSON.stringify(v));
else if(name!=="days"&&Array.isArray(v))localStorage.setItem(key,JSON.stringify(v.slice(0,name==="favorites"?2000:500)));}
$("brain-backup-status").textContent="已导入第二大脑与学习记录。";refresh();}catch(err){$("brain-backup-status").textContent="导入失败："+err.message;}finally{evt.target.value="";}}
function init(){
for(const id of ["note-area","project-area"])fillAreas(id);fillAreas("notes-filter",true);projectOptions();
$("capture-form").addEventListener("submit",saveCapture);
$("inbox-sort").addEventListener("click",()=>{ascending=!ascending;$("inbox-sort").textContent=ascending?"最早优先":"最新优先";renderInbox();});
$("note-new").addEventListener("click",()=>openNote());$("note-cancel").addEventListener("click",closeNote);$("note-form").addEventListener("submit",submitNote);
$("notes-filter").addEventListener("change",e=>{notesFilter=e.target.value;renderNotes();});
$("project-new").addEventListener("click",()=>{$("project-form").hidden=false;$("project-name").focus();});
$("project-cancel").addEventListener("click",()=>{$("project-form").hidden=true;$("project-form").reset();});
$("project-form").addEventListener("submit",newProject);$("task-form").addEventListener("submit",submitTask);
$("project-view").addEventListener("change",renderProjects);
$("week-form").addEventListener("submit",storeWeek);
$("week-copy").addEventListener("click",async()=>{const s=["每周复盘（"+weekKey()+"）","收获："+$("week-insight").value,"阻碍："+$("week-blocker").value,"下一步："+$("week-next").value].join("\n");try{await navigator.clipboard.writeText(s);$("week-status").textContent="已复制本周复盘";}catch{$("week-status").textContent="浏览器无法复制，请手动选取文本";}});
$("brain-search-form").addEventListener("submit",searchSubmit);
$("search-scope").addEventListener("change",e=>{SEARCH.scope=e.target.value;SEARCH.shown=20;renderSearch();});
let timer;$("brain-search").addEventListener("input",e=>{clearTimeout(timer);timer=setTimeout(()=>{if(!e.target.value.trim()&&currentTab!=="search")return;SEARCH.term=str(e.target.value,160);SEARCH.shown=20;show("search");if(SEARCH.term)loadPublic();},220);});
$("load-public").addEventListener("click",loadPublic);$("search-more").addEventListener("click",()=>{SEARCH.shown+=20;renderSearch();});
$("brain-export").addEventListener("click",backup);$("brain-import").addEventListener("change",importFile);
for(const b of document.querySelectorAll(".brain-tabs [data-tab]"))b.addEventListener("click",()=>show(b.dataset.tab));
document.addEventListener("keydown",evt=>{if(evt.ctrlKey||evt.metaKey||evt.altKey)return;
const focused=document.activeElement,editing=["INPUT","TEXTAREA","SELECT"].includes(focused?.tagName)||focused?.isContentEditable;
if(!editing&&(evt.key==="/"||evt.key==="c"||evt.key==="C")){evt.preventDefault();if(evt.key==="/"){$("brain-search").focus();}else{$("capture-content").focus();$("capture").scrollIntoView({block:"start"});}}});
refresh();const params=new URLSearchParams(location.search);const tab=params.get("tab"),q=params.get("q"),note=params.get("note"),inbox=params.get("inbox"),capture=params.get("capture");
if(capture){$("capture-content").value=str(capture,4000);const source=validUrl(params.get("source")||"");if(source){$("capture-url").value=source;$("capture-kind").value="source";}$("capture-content").focus();}
if(q)selectSearch(q);else if(note){const n=data.notes.find(x=>x.id===note);if(n)openNote(null,n);else show("notes");}
else if(inbox){show("inbox");const item=data.inbox.find(x=>x.id===inbox);if(item)openNote(item);}
else if(["inbox","notes","projects","search","weekly"].includes(tab))show(tab);else show("inbox");
}
init();
})();