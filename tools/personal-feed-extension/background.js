/* Consent-based browser-to-GitHub writer. Token stays in chrome.storage.local. */
"use strict";
const DEFAULT_REPO="imxiel126/imxiel126.github.io";
let running=false;
const KEY="social/personal-feed.json";
const safely=(x,max=180)=>String(x||"").replace(/\s+/g," ").trim().slice(0,max);
const cleanCard=c=>{
 try{
  const u=new URL(c.url),platform=c.platform;
  const h=u.hostname.toLowerCase();
  if(u.protocol!=="https:"||!
   (platform==="zhihu"&&["www.zhihu.com","zhuanlan.zhihu.com","zhihu.com"].includes(h)||
    platform==="xiaohongshu"&&["www.xiaohongshu.com","xiaohongshu.com"].includes(h)))return null;
  u.search="";u.hash="";
  if(!safely(c.title,140))return null;
  return {platform,title:safely(c.title,140),summary:safely(c.summary,200),
   url:u.href,source:"logged_in_recommendation_page",
   observed_at:/^\d{4}-\d{2}-\d{2}T/.test(c.observed_at||"")?c.observed_at:new Date().toISOString()};
 }catch{return null;}
};
const b64=s=>{
 const bytes=new TextEncoder().encode(s);let binary="";
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));
 return btoa(binary);
};
async function saveGitHub(force=false){
 if(running)return {status:"busy"};
 running=true;
 try{
  const o=await chrome.storage.local.get(["enabled","confirmedPublic","githubToken","repository","observed","lastSynced"]);
  if(!o.enabled||!o.confirmedPublic)return {status:"disabled"};
  const token=(o.githubToken||"").trim();
  const repo=(o.repository||DEFAULT_REPO).trim();
  if(!token)return {status:"needs_github_token"};
  if(!/^[-\w]+\/[-\w.]+$/.test(repo))return {status:"invalid_repo"};
  if(!force && Date.now()-(o.lastSynced||0)<10*60*1000){
    // A tab may be closed before the next capture; keep a local flush alarm.
    await chrome.alarms.create("personal-feed-flush",{
      when:Math.max(Date.now()+60*1000,(o.lastSynced||0)+10*60*1000+1000)
    });
    return {status:"rate_limited"};
  }
  const cards=(Array.isArray(o.observed)?o.observed:[]).map(cleanCard).filter(Boolean).slice(0,90);
  if(!cards.length)return {status:"no_recommendations_captured"};
  const base="https://api.github.com/repos/"+repo+"/contents/"+KEY;
  const headers={Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  let sha;
  const read=await fetch(base,{headers});
  if(read.ok){sha=(await read.json()).sha;}
  else if(read.status!==404)throw Error("GitHub GET "+read.status+" (verify repository/token)");
  const data={schema_version:1,source:"local_authorized_browser",
   updated_at:new Date().toISOString(),items:cards};
  const body={message:"sync: authorized browser recommendation previews",content:b64(JSON.stringify(data,null,2)+"\n")};
  if(sha)body.sha=sha;
  const write=await fetch(base,{method:"PUT",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!write.ok)throw Error("GitHub PUT "+write.status+": "+(await write.text()).slice(0,250));
  await chrome.storage.local.set({lastSynced:Date.now(),lastError:""});
  await chrome.alarms.clear("personal-feed-flush");
  return {status:"synced",count:cards.length};
 }catch(err){
  const msg=String(err?.message||err).slice(0,350);
  await chrome.storage.local.set({lastError:msg});return {status:"error",message:msg};
 }finally{running=false;}
}
chrome.alarms.onAlarm.addListener(alarm=>{
 if(alarm.name==="personal-feed-flush")saveGitHub(true).catch(()=>{});
});
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
 (async()=>{
  if(msg?.type==="observedRecommendations"){
   const existing=await chrome.storage.local.get(["enabled","confirmedPublic","observed"]);
   if(!existing.enabled||!existing.confirmedPublic)return {status:"disabled"};
   const received=(Array.isArray(msg.cards)?msg.cards:[]).map(cleanCard).filter(Boolean);
   const prev=Array.isArray(existing.observed)?existing.observed:[];
   const unique=new Map();
   for(const c of [...received,...prev])if(!unique.has(c.platform+"|"+c.url))unique.set(c.platform+"|"+c.url,c);
   const sorted=[...unique.values()].sort((a,b)=>b.observed_at.localeCompare(a.observed_at)).slice(0,90);
   await chrome.storage.local.set({observed:sorted});
   return saveGitHub();
  }
  if(msg?.type==="syncNow")return saveGitHub(true);
  if(msg?.type==="getStatus"){
   const s=await chrome.storage.local.get(["enabled","confirmedPublic","observed","lastSynced","lastError","repository"]);
   return {enabled:!!s.enabled,confirmedPublic:!!s.confirmedPublic,count:s.observed?.length||0,
    lastSynced:s.lastSynced||0,lastError:s.lastError||"",repository:s.repository||DEFAULT_REPO};
  }
  return {status:"unknown"};
 })().then(sendResponse,e=>sendResponse({status:"error",message:String(e)}));
 return true;
});