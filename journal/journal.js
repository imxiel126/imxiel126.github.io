/* 随手记 · 本地优先；只有用户逐条勾选并确认才写入公开 GitHub 仓库。 */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const KEY="zhixing-journal-v1";
const LEARN_DAYS="zhixing-days-v1",LEARN_QUEUE="zhixing-queue-v1";
const REPO="imxiel126/imxiel126.github.io",FILE="journal/data.json";
const API="https://api.github.com/repos/"+REPO+"/contents/"+FILE;
const MAX_PUBLIC=1000;
const node=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined&&value!==null)e.textContent=String(value);if(cls)e.className=cls;return e;};
const str=(v,max=6000)=>String(v===null||v===undefined?"":v).trim().slice(0,max);
const day=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).replace(/\//g,"-");
const now=()=>new Date().toISOString();
const validDate=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v);
const safeUrl=v=>{try{if(!v)return "";const u=new URL(v);return ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password?u.href:"";}catch{return"";}};
const storeRead=(key,otherwise)=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v):otherwise;}catch{return otherwise;}};
const randomId=()=>globalThis.crypto?.randomUUID?.()||("j-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
const hash=v=>{let h=2166136261;for(const c of v){h=Math.imul(h^c.charCodeAt(0),16777619)}return (h>>>0).toString(36)};
function sanitize(raw,origin){
 if(!raw||typeof raw!=="object")return null;
 const kind=raw.kind==="later"?"later":raw.kind==="idea"?"idea":null;
 const title=str(raw.title,140);
 if(!kind||!title)return null;
 const url=safeUrl(raw.url);
 const tags=Array.isArray(raw.tags)?raw.tags.map(t=>str(t,28)).filter(Boolean).slice(0,8):[];
 const id=str(raw.id,180)||randomId();
 const created=typeof raw.created_at==="string"?raw.created_at:now();
 return {id,kind,title,body:str(raw.body,6000),url,tags,
    created_at:created,updated_at:typeof raw.updated_at==="string"?raw.updated_at:created,
    date:validDate(raw.date)?raw.date:day(),read:!!raw.read,
    origin:origin||"journal"};
}
let local=(Array.isArray(storeRead(KEY,[]))?storeRead(KEY,[]):[]).map(x=>sanitize(x,"journal")).filter(Boolean);
let published=[],selected=new Set(),busy=false,remoteAvailable=false;
function persist(){
 try{localStorage.setItem(KEY,JSON.stringify(local.slice(0,800)));return true;}
 catch{$("save-message").textContent="本地保存失败，请先导出备份";return false;}
}
function learnRecords(){
 const output=[];
 const days=storeRead(LEARN_DAYS,{});
 if(days&&typeof days==="object"&&!Array.isArray(days)){
  for(const [date,v] of Object.entries(days).slice(-365)){
   if(!validDate(date)||!v||typeof v!=="object")continue;
   const question=str(v.question,240),note=str(v.note,6000);
   if(!question&&!note)continue;
   const x=sanitize({
    id:"learn-day:"+date,kind:"idea",
    title:question||date+" 今日学习记录",body:note,date,
    created_at:typeof v.updated==="string"?v.updated:date+"T00:00:00+08:00",
    updated_at:typeof v.updated==="string"?v.updated:date+"T00:00:00+08:00",
    tags:["学习台"]
   },"learn");
   if(x)output.push(x);
  }
 }
 const q=storeRead(LEARN_QUEUE,[]);
 if(Array.isArray(q))for(const v of q.slice(0,200)){
  if(!v||typeof v!=="object")continue;
  const url=safeUrl(v.url);
  if(!url)continue;
  const d=validDate(v.saved)?v.saved:day();
  const x=sanitize({
   id:"learn-queue:"+hash(url)+":"+url.length,kind:"later",
   title:str(v.title||url,140),body:str(v.source,160),url,
   date:d,created_at:d+"T00:00:00+08:00",tags:["学习台","稍后阅读"]
  },"learn");
  if(x)output.push(x);
 }
 return output;
}
function all(){
 const map=new Map();
 for(const x of learnRecords())map.set(x.id,x);
 for(const x of local)map.set(x.id,x);
 // GitHub 记录优先显示为已公开，同 ID 不重复。
 for(const x of published)map.set(x.id,{...x,origin:"github"});
 return [...map.values()].sort((a,b)=>String(b.updated_at||b.created_at||"").localeCompare(String(a.updated_at||a.created_at||"")));
}
function counts(){
 const items=all();
 $("stat-ideas").textContent="想法 "+items.filter(x=>x.kind==="idea").length;
 $("stat-reading").textContent="待读 "+items.filter(x=>x.kind==="later"&&!x.read).length;
 $("stat-read").textContent="已读 "+items.filter(x=>x.kind==="later"&&x.read).length;
 $("stat-local").textContent="待上传 "+items.filter(x=>x.origin!=="github").length+" · 已公开 "+published.length;
}
function updateSelectionInfo(){
 const number=selected.size;
 $("sync-btn").textContent=number?"将选中的 "+number+" 条公开上传到 GitHub":"请选择要公开上传的记录";
 $("sync-btn").disabled=busy||!number;
}
function isPublic(item){return published.some(x=>x.id===item.id)}
function reviewCard(item){
 const card=node("article",null,"journal-item");
 const head=node("div",null,"journal-item-head"),left=node("span",(item.kind==="idea"?"今日想法":"稍后阅读")+" · "+item.date);
 const isRemote=item.origin==="github";
 head.append(left,node("span",isRemote?"GitHub 已公开":item.origin==="learn"?"学习台 · 仅本机":"仅本机","journal-pill"+(isRemote?"":" local")));
 card.append(head,node("h3",item.title));
 if(item.body)card.append(node("p",item.body));
 if(item.url){
  const source=node("a","访问原文 ↗");source.href=item.url;source.target="_blank";source.rel="noopener noreferrer";
  card.append(source);
 }
 if(item.tags.length){const tags=node("div",null,"journal-tags");for(const tag of item.tags)tags.append(node("span",tag));card.append(tags);}
 const actions=node("div",null,"journal-item-actions");
 if(!isRemote){
  const choice=node("label",null,"journal-publish-choice"),checkbox=document.createElement("input");
  checkbox.type="checkbox";checkbox.checked=selected.has(item.id);
  checkbox.setAttribute("aria-label","选择公开上传："+item.title);
  checkbox.addEventListener("change",()=>{if(checkbox.checked)selected.add(item.id);else selected.delete(item.id);updateSelectionInfo();});
  choice.append(checkbox,node("span","选择公开上传"));actions.append(choice);
 }
 if(item.kind==="later"&&!isRemote){
  const button=node("button",item.read?"恢复待读":"标记已读");button.type="button";
  button.addEventListener("click",()=>{const next={...item,read:!item.read,origin:"journal",updated_at:now()};
   local=[next,...local.filter(x=>x.id!==next.id)];
   if(item.origin==="learn"){
    const q=storeRead(LEARN_QUEUE,[]);
    if(Array.isArray(q))try{localStorage.setItem(LEARN_QUEUE,JSON.stringify(q.filter(x=>safeUrl(x.url)!==item.url)));}catch{}
   }
   persist();render();
  });actions.append(button);
 }
 if(item.origin==="journal"){
  const button=node("button","删除本地记录");button.type="button";
  button.addEventListener("click",()=>{if(!confirm("仅删除本机这条记录？如果已经上传 GitHub，公开副本不会因此删除。"))return;
   local=local.filter(x=>x.id!==item.id);selected.delete(item.id);persist();render();
  });actions.append(button);
 }
 if(item.origin==="learn"){
  const link=node("a","回学习台编辑 ↗");link.href="/learn/";actions.append(link);
 }
 if(isRemote){
  const hint=node("span","已在个人主页公开展示","journal-hint");actions.append(hint);
 }
 card.append(actions);return card;
}
function render(){
 counts();
 const query=str($("review-search").value,160).toLowerCase(),kind=$("review-kind").value;
 let items=all().filter(x=>{
  if(kind==="idea"&&x.kind!=="idea")return false;
  if(kind==="later"&&x.kind!=="later")return false;
  if(kind==="unread"&&(x.kind!=="later"||x.read))return false;
  if(kind==="done"&&(x.kind!=="later"||!x.read))return false;
  return !query||[x.title,x.body,x.url,x.tags.join(" ")].join(" ").toLowerCase().includes(query);
 });
 if($("review-order").value==="old")items.reverse();
 const target=$("entries");target.replaceChildren();
 if(!items.length)target.append(node("p","这里还没有符合筛选条件的记录。先写下一条想法，或在学习台保存稍后阅读。","journal-empty"));
 for(const item of items.slice(0,150))target.append(reviewCard(item));
 if(items.length>150)target.append(node("p","还有 "+(items.length-150)+" 条。可用关键词筛选。","journal-hint"));
 updateSelectionInfo();
}
function readPublic(){
 $("sync-status").textContent="正在读取 GitHub 公开记录…";
 return fetch("/journal/data.json?fresh="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()})
 .then(d=>{
   published=(Array.isArray(d.items)?d.items:[]).map(x=>sanitize(x,"github")).filter(Boolean);
   remoteAvailable=true;
   $("sync-status").textContent="GitHub 已公开 "+published.length+" 条"+(d.updated_at?" · 最近上传："+new Date(d.updated_at).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"}):"")+"。";
   for(const x of published)selected.delete(x.id);
   render();
 }).catch(e=>{remoteAvailable=false;$("sync-status").textContent="公开记录暂时无法加载；本机内容不受影响。"+String(e.message||e);render();});
}
function decodeBase64(text){
 const bytes=Uint8Array.from(atob(String(text||"").replace(/\s+/g,"")),c=>c.charCodeAt(0));
 return new TextDecoder().decode(bytes);
}
function encodeBase64(text){
 const bytes=new TextEncoder().encode(text);let raw="";
 for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.slice(i,i+8192));
 return btoa(raw);
}
async function publish(){
 if(busy)return;
 const selection=all().filter(x=>selected.has(x.id)&&x.origin!=="github");
 if(!selection.length){$("sync-status").textContent="请先在下方记录列表中勾选要公开上传的内容。";return;}
 if(!$("public-consent").checked){$("sync-status").textContent="请先确认这些记录适合公开展示。";return;}
 const token=str($("sync-token").value,300);
 if(!token){$("sync-status").textContent="请填写仅授予此仓库 Contents 写入权限的 GitHub Token。";return;}
 if(!confirm("将 "+selection.length+" 条记录公开上传到 "+REPO+"。任何人可能查看，包括 Git 历史记录。确定继续吗？"))return;
 busy=true;updateSelectionInfo();$("sync-status").textContent="正在提交 "+selection.length+" 条记录…";
 const headers={Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
 try{
  let latest;
  for(let attempt=1;attempt<=3;attempt++){
   const get=await fetch(API,{headers,cache:"no-store"});
   if(!get.ok)throw Error("读取 GitHub 失败："+get.status+"。请检查 Token 是否授权正确仓库。");
   const file=await get.json();
   latest=JSON.parse(decodeBase64(file.content));
   const current=(Array.isArray(latest.items)?latest.items:[]).map(x=>sanitize(x,"github")).filter(Boolean);
   const map=new Map(current.map(x=>[x.id,x]));
   // 只新增用户本次明确勾选的记录，不上传其他本地笔记。
   for(const x of selection)map.set(x.id,{...x,origin:"journal"});
   if(map.size>MAX_PUBLIC)throw Error("公开记录已接近 "+MAX_PUBLIC+" 条限制，请先整理旧内容。");
   const items=[...map.values()].sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
   const body={message:"journal: publish "+selection.length+" selected personal entries",
    sha:file.sha,content:encodeBase64(JSON.stringify({schema_version:1,updated_at:now(),items},null,2)+"\n")};
   const put=await fetch(API,{method:"PUT",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(put.ok){
    published=items.map(x=>({...x,origin:"github"}));remoteAvailable=true;
    selected.clear();$("public-consent").checked=false;$("sync-token").value="";
    render();
    $("sync-status").textContent="已成功写入 GitHub（"+selection.length+" 条）。网站完成 Pages 发布后，其他设备也可以查看。";
    return;
   }
   if((put.status===409||put.status===422)&&attempt<3)continue;
   throw Error("提交 GitHub 失败："+put.status+" "+(await put.text()).slice(0,200));
  }
 }catch(e){$("sync-status").textContent="上传未完成："+String(e.message||e).slice(0,350)+"；本地记录仍然保留。";}
 finally{busy=false;updateSelectionInfo();}
}
function downloadBackup(){
 const data={version:1,exported_at:now(),journal:local,learning_days:storeRead(LEARN_DAYS,{}),learning_queue:storeRead(LEARN_QUEUE,[])};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
 const href=URL.createObjectURL(blob),a=node("a");a.href=href;a.download="知行手记-本地记录备份-"+day()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2500);
 $("sync-status").textContent="已导出本机记录备份；文件包含个人内容，请妥善保管。";
}
function submit(e){
 e.preventDefault();
 const kind=document.querySelector('input[name="kind"]:checked')?.value||"idea";
 const title=str($("entry-title").value,140),body=str($("entry-body").value,6000);
 const url=safeUrl($("entry-url").value.trim());
 const rawUrl=$("entry-url").value.trim();
 if(!title){$("save-message").textContent="请填写标题";return;}
 if(rawUrl&&!url){$("save-message").textContent="请输入有效的 http(s) 链接";return;}
 const tags=$("entry-tags").value.split(/[,，;；]/).map(x=>str(x,28)).filter(Boolean).slice(0,8);
 const item=sanitize({id:randomId(),kind,title,body,url,tags,date:day(),created_at:now(),read:false},"journal");
 if(!item)return;
 local.unshift(item);local=local.slice(0,800);
 if(!persist()){local.shift();return;}
 $("capture-form").reset();
 $("save-message").textContent="已保存到当前浏览器。要上传 GitHub，请在下方勾选这条记录，再点击上传。";
 render();
}
$("capture-form").addEventListener("submit",submit);
$("reset-entry").addEventListener("click",()=>{$("capture-form").reset();$("save-message").textContent="";});
$("sync-btn").addEventListener("click",publish);
$("refresh-btn").addEventListener("click",readPublic);
$("download-btn").addEventListener("click",downloadBackup);
["review-kind","review-order"].forEach(k=>$(k).addEventListener("change",render));
$("review-search").addEventListener("input",render);
window.addEventListener("storage",e=>{if([KEY,LEARN_DAYS,LEARN_QUEUE].includes(e.key)){local=(Array.isArray(storeRead(KEY,[]))?storeRead(KEY,[]):[]).map(x=>sanitize(x,"journal")).filter(Boolean);render();}});
const params=new URLSearchParams(location.search);
const presetKind=params.get("kind");
if(presetKind==="idea"||presetKind==="later"){const input=document.querySelector('input[name="kind"][value="'+presetKind+'"]');if(input)input.checked=true;}
if(params.has("title"))$("entry-title").value=str(params.get("title"),140);
if(params.has("url"))$("entry-url").value=safeUrl(params.get("url"));
render();readPublic();
})();