/* Shared read-only-to-private capture action. No network request or GitHub API. */
(function(global){"use strict";
const KEY="zhixing-brain-v1";
function capture(input){
 try{
  const text=String(input?.text||input?.title||"").trim().slice(0,4000);
  if(!text)return {ok:false,reason:"内容为空"};
  const raw=String(input?.url||"").trim();
  let url="";
  if(raw){
   const u=new URL(raw,global.location.origin);
   if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return {ok:false,reason:"链接不安全"};
   url=u.href.slice(0,1500);
  }
  const fallback={version:1,inbox:[],notes:[],projects:[],tasks:[],weeks:{}};
  const parsed=JSON.parse(global.localStorage.getItem(KEY)||"null");
  const data=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:fallback;
  if(!Array.isArray(data.inbox))data.inbox=[];
  const kind=["source","idea","question","action"].includes(input?.kind)?input.kind:"source";
  const prefix=input?.source?"【"+String(input.source).slice(0,45)+"】 ":"";
  const body=prefix+text;
  if(data.inbox.some(x=>x.text===body&&(!url||x.url===url)))return {ok:true,duplicate:true};
  if(data.inbox.length>=500)return {ok:false,reason:"收集箱已满，请先整理"};
  const id=global.crypto?.randomUUID?.()||"cb"+Date.now().toString(36)+Math.random().toString(36).slice(2);
  data.inbox.unshift({id,type:kind,text:body,url,created:new Date().toISOString(),deferUntil:""});
  global.localStorage.setItem(KEY,JSON.stringify(data));
  return{ok:true,duplicate:false};
 }catch(e){return{ok:false,reason:"浏览器存储不可用"};}
}
global.ZhixingBrain={capture};
})(window);
