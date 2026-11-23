/* 公开内容发现：只读取仓库公开 JSON，不读取任何平台登录凭据。 */
(()=>{
'use strict';
const root=document.getElementById('social-recommendations');if(!root)return;
const grid=root.querySelector('#social-rec-grid'),status=root.querySelector('#social-rec-status');
const tabs=[...root.querySelectorAll('[data-social-filter]')],switcher=root.querySelector('#social-rec-switch');
let feed=[],filter='all',offset=0,updated='';
const names={zhihu:'知乎',xiaohongshu:'小红书'};
function safe(url,p){
 try{const u=new URL(url),host=u.hostname.toLowerCase();
   if(u.protocol!=='https:')return '';
   const whitelist=p==='zhihu'?['zhihu.com']:['xiaohongshu.com','xhslink.com'];
   return whitelist.some(d=>host===d||host.endsWith('.'+d))?u.href:'';
 }catch{return '';}
}
function node(tag,content,cls){const e=document.createElement(tag);if(content!==undefined)e.textContent=String(content);if(cls)e.className=cls;return e;}
function card(it){
 const link=safe(it.url,it.platform);if(!link)return null;
 const a=node('a',undefined,'social-rec-card');a.href=link;a.target='_blank';a.rel='noopener noreferrer';
 const top=node('span',undefined,'social-rec-card-top');
 top.append(node('span',names[it.platform]||'公开网页',it.platform==='zhihu'?'social-rec-platform zh':'social-rec-platform xhs'));
 top.append(node('span',it.kind==='topic'?'站内实时搜索入口':it.origin==='public_search'?'公开网页检索':'公开文章精选','social-rec-kind'));
 a.append(top,node('strong',it.title||'查看原文'),node('p',it.summary||'访问公开页面查看完整内容'));
 const bottom=node('span',undefined,'social-rec-card-bottom');
 bottom.append(node('span',it.topic||'知识发现'),node('span',it.kind==='topic'?'查看平台动态 ↗':'阅读公开原文 ↗'));
 a.append(bottom);return a;
}
function select(items,n,seed){
 if(!items.length)return [];
 const pool=[...items].sort((a,b)=>{
   const weight=x=>x.kind==='topic'?0:x.origin==='public_search'?2:1;
   return weight(b)-weight(a)||(b.discovered_at||'').localeCompare(a.discovered_at||'');
 });
 const start=seed%pool.length;
 return Array.from({length:Math.min(n,pool.length)},(_,i)=>pool[(start+i)%pool.length]);
}
function render(){
 const hourBucket=Math.floor(Date.now()/14400000)+offset;
 const zh=feed.filter(x=>x.platform==='zhihu');
 const xhs=feed.filter(x=>x.platform==='xiaohongshu');
 const selection=filter==='zhihu'?select(zh,6,hourBucket):filter==='xiaohongshu'?select(xhs,6,hourBucket):[...select(zh,3,hourBucket),...select(xhs,3,hourBucket+2)];
 grid.replaceChildren(...selection.map(card).filter(Boolean));
 if(!grid.childElementCount)grid.append(node('p','暂未获取到符合要求的公开内容，请通过下方入口到平台查看最新推荐。','social-rec-empty'));
 status.textContent='公开内容发现'+(updated?' · 数据最近更新：'+updated.slice(0,10):'')+' · 每次打开或点击换一批均会重新选择展示内容；非账号的个性化推荐流';
}
function load(){
 fetch('/social/recommendations.json?t='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>{
  updated=d.updated_at||'';
  feed=(Array.isArray(d.items)?d.items:[]).filter(x=>names[x.platform]&&safe(x.url,x.platform));
  render();
 }).catch(e=>{grid.replaceChildren(node('p','推荐数据暂时无法读取。可通过下方链接进入知乎和小红书推荐。','social-rec-empty'));status.textContent='公开数据读取失败';console.warn('social recommendations',e)});
}
tabs.forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.socialFilter;tabs.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));offset=0;render()}));
if(switcher)switcher.addEventListener('click',()=>{offset++;render()});
load();
setInterval(load,20*60*1000);
})();