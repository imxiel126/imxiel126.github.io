/* Only displays recommendation items actually captured in signed-in browsers.
No RSS, search results or guessed topics. Public GitHub Pages must not contain cookies or tokens. */
(()=>{
"use strict";
const root=document.getElementById("personal-recommendations");if(!root)return;
const grid=root.querySelector("#personal-rec-grid"),status=root.querySelector("#personal-rec-status");
const tabs=Array.from(root.querySelectorAll("[data-personal-filter]"));let filter="all",items=[],updated=null;
const allowed=(url,p)=>{try{const u=new URL(url);if(u.protocol!=="https:")return "";
 const h=u.hostname.toLowerCase();
 return (p==="zhihu"&&(h==="www.zhihu.com"||h==="zhuanlan.zhihu.com"||h==="zhihu.com")||
 p==="xiaohongshu"&&(h==="www.xiaohongshu.com"||h==="xiaohongshu.com"))?u.href:"";}catch{return""}};
const txt=(tag,value,className)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=String(value);if(className)el.className=className;return el;};
function show(){
 const filtered=items.filter(it=>(filter==="all"||it.platform===filter)&&allowed(it.url,it.platform)).slice(0,12);
 grid.replaceChildren();
 if(!filtered.length){
 const wrap=txt("div",undefined,"social-rec-empty");
 wrap.append(txt("strong",filter==="all"?"尚未连接真实推荐流":"该平台尚无已同步的推荐卡片"));
 wrap.append(txt("p","目前只关联了账号主页，尚未授权浏览器自动同步。这里不会用搜索文章填充。"));
 grid.append(wrap);
 }else filtered.forEach(it=>{
 const card=txt("a",undefined,"social-rec-card"),src=allowed(it.url,it.platform);
 card.href=src;card.target="_blank";card.rel="noopener noreferrer";
 const meta=txt("span",undefined,"social-rec-card-top");
 meta.append(txt("span",it.platform==="zhihu"?"知乎":"小红书",it.platform==="zhihu"?"social-rec-platform zh":"social-rec-platform xhs"),
 txt("span","来自登录后的推荐页","social-rec-kind"));
 card.append(meta,txt("strong",(it.title||"查看推荐内容").slice(0,150)));
 if(it.summary)card.append(txt("p",it.summary.slice(0,230)));
 const bottom=txt("span",undefined,"social-rec-card-bottom");
 bottom.append(txt("span",it.observed_at?it.observed_at.slice(0,10):"浏览器同步"),txt("span","查看原文 ↗"));
 card.append(bottom);grid.append(card);
 }));
 status.textContent=updated?"浏览器推荐同步时间："+new Date(updated).toLocaleString("zh-CN")+" · 仅展示最近实际采集到的卡片":"尚未配置浏览器端同步 · 不包含平台私人推荐数据";
}
function load(){
 fetch("/social/personal-feed.json?nocache="+Date.now(),{cache:"no-store"})
 .then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()})
 .then(d=>{updated=d.updated_at||null;items=(Array.isArray(d.items)?d.items:[])
  .filter(x=>x&&x.source==="logged_in_recommendation_page"&&allowed(x.url,x.platform))
  .sort((a,b)=>String(b.observed_at||"").localeCompare(String(a.observed_at||"")));show();})
 .catch(()=>{items=[];updated=null;show();status.textContent="同步数据暂不可用";});
}
tabs.forEach(btn=>btn.addEventListener("click",()=>{filter=btn.dataset.personalFilter;tabs.forEach(b=>b.setAttribute("aria-pressed",String(b===btn)));show()}));
root.querySelector("#personal-refresh").addEventListener("click",load);
load();setInterval(load,5*60*1000);
})();