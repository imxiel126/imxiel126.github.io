/* Browser DOM capture: no platform API calls, credentials, cookies or hidden tabs. */
(()=>{
"use strict";
const host=location.hostname,platform=host==="www.zhihu.com"?"zhihu":host==="www.xiaohongshu.com"?"xiaohongshu":null;
if(!platform)return;
const isFeed=()=>{
 const path=location.pathname;
 if(platform==="zhihu")return path==="/" || path==="/follow" || path==="/hot"; // only root recommendation when path is /
 if(path!=="/explore")return false;
 const channel=new URLSearchParams(location.search).get("channel_id");
 return !channel || channel==="homefeed_recommend";
};
const active=()=>isFeed()&&(platform==="xiaohongshu"||location.pathname==="/");
const patterns=platform==="zhihu"?
 ['a[href*="/question/"]','a[href*="zhuanlan.zhihu.com/p/"]','a[href^="/p/"]']:
 ['a[href*="/explore/"]','a[href*="/discovery/item/"]'];
const normalize=s=>String(s||"").replace(/\s+/g," ").trim();
const valid=(href)=>{
 try{const u=new URL(href,location.href),h=u.hostname.toLowerCase(),p=u.pathname;
 if(u.protocol!=="https:")return "";
 if(platform==="zhihu"&&!(h==="www.zhihu.com"||h==="zhuanlan.zhihu.com"||h==="zhihu.com"))return "";
 if(platform==="xiaohongshu"&&!(h==="www.xiaohongshu.com"||h==="xiaohongshu.com"))return "";
 if(platform==="zhihu"&&!(/^\/question\/\d+/.test(p)||/^\/p\/\d+/.test(p)))return "";
 if(platform==="xiaohongshu"&&!(/^\/explore\/[0-9a-f]{16,}/i.test(p)||/^\/discovery\/item\/[0-9a-f]{16,}/i.test(p)))return "";
 u.search="";u.hash="";return u.href;
 }catch{return"";}
};
let lastSeen=0, lastSig="";
function extract(){
 if(!active()||document.visibilityState!=="visible")return;
 const cards=[],seen=new Set();
 for(const link of document.querySelectorAll(patterns.join(","))){
  if(cards.length>=35)break;
  const url=valid(link.getAttribute("href"));if(!url||seen.has(url))continue;
  const card=link.closest("article, li, section, [class*=feed-card], [class*=note-item], [class*=contentItem], [class*=ContentItem]")||link.parentElement;
  const titleNode=card?.querySelector("h1,h2,h3,[class*=title],[class*=Title]");
  const title=normalize(titleNode?.textContent||link.getAttribute("title")||link.getAttribute("aria-label")||link.innerText||link.querySelector("img")?.alt).slice(0,140);
  if(title.length<5 || /^推荐$|^关注$|^更多$/.test(title))continue;
  let summary=normalize(card?.innerText||"").slice(0,220);
  if(summary.startsWith(title))summary=normalize(summary.slice(title.length)).slice(0,180);
  if(summary===title)summary="";
  seen.add(url);
  cards.push({platform,title,summary,url,source:"logged_in_recommendation_page",observed_at:new Date().toISOString()});
 }
 if(!cards.length)return;
 const sig=cards.map(x=>x.url).join("|");
 if(sig===lastSig && Date.now()-lastSeen<120000)return;
 lastSig=sig;lastSeen=Date.now();
 chrome.runtime.sendMessage({type:"observedRecommendations",cards}).catch(()=>{});
}
let scheduled=false;
const queue=()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;extract();},1500)};
new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
window.addEventListener("scroll",queue,{passive:true});
document.addEventListener("visibilitychange",queue);
setInterval(extract,45000);
queue();
})();