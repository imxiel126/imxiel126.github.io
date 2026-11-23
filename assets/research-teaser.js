(()=>{"use strict";
const root=document.getElementById("research-teaser");if(!root)return;
const title=root.querySelector("#research-teaser-title"),meta=root.querySelector("#research-teaser-meta"),intro=root.querySelector("#research-teaser-desc");
fetch("/research/data.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(d=>{
const items=Array.isArray(d.news)?d.news:[], item=items.find(x=>x.type==="hydrogen")||items.find(x=>x.type==="papers")||items[0];
if(!item){meta.textContent="研究资料已连接";intro.textContent="进入研究栏目查看学术索引与技术动态。";return;}
title.textContent=item.title||"最新研究动态";
meta.textContent=(item.type==="hydrogen"?"氢能":item.type==="papers"?"前沿论文":"科研资讯")+(item.date?" · "+item.date:"");
intro.textContent=(item.summary||"").slice(0,130)||"原研究站已更新公开资讯；进入研究栏目可查看更多内容。";
}).catch(()=>{meta.textContent="研究资料暂时无法读取";intro.textContent="可进入研究栏目查看已发布的学术资料。";});
})();