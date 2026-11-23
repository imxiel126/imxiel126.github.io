/* 2000 条原创阅读思考：每日北京时间自动轮换，支持检索与分类 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const host=$('reading-reflections');if(!host)return;
const daily=$('ref-daily'),listing=$('ref-results'),counter=$('ref-counter'),dateLabel=$('ref-date');
const search=$('ref-search'),category=$('ref-category'),more=$('ref-more'),next=$('ref-next');
let cards=[],state={day:"",offset:0,page:0};
const h=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;};
function shanghaiDate(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const o={};for(const p of parts)o[p.type]=p.value;
  return o.year+'-'+o.month+'-'+o.day;
}
function cardBox(item){
  const box=h('article',undefined,'ref-card');
  box.append(h('small',item.category+' · #'+item.id),h('h3',item.title),h('p',item.view),h('p','行动练习：'+item.practice,'ref-action'));
  return box;
}
function dayStart(day){return Math.floor((Date.parse(day+'T00:00:00Z')-Date.UTC(2026,0,1))/86400000);}
function renderDaily(){
  if(!cards.length)return;
  const day=shanghaiDate();state.day=day;dateLabel.textContent=day.replaceAll('-','.')+' · 今日精选 6 条';
  const start=((dayStart(day)*7 + state.offset*19)%cards.length+cards.length)%cards.length;
  const picks=Array.from({length:6},(_,i)=>cards[(start+i*23)%cards.length]);
  daily.replaceChildren(...picks.map(cardBox));
}
function renderList(){
  const q=search.value.trim().toLocaleLowerCase('zh-CN'),type=category.value;
  const matched=cards.filter(c=>(type==='all'||c.category===type)&&
    (!q||[c.title,c.topic,c.category,c.view,c.practice].join(' ').toLocaleLowerCase('zh-CN').includes(q)));
  const limit=(state.page+1)*18;
  listing.replaceChildren(...matched.slice(0,limit).map(cardBox));
  counter.textContent='匹配 '+matched.length+' 条 · 当前显示 '+Math.min(matched.length,limit)+' 条';
  more.hidden=matched.length<=limit;
  if(!matched.length)listing.append(h('p','没有匹配内容，可更换关键词。','ref-empty'));
}
search.addEventListener('input',()=>{state.page=0;renderList();});
category.addEventListener('change',()=>{state.page=0;renderList();});
more.addEventListener('click',()=>{state.page+=1;renderList();});
next.addEventListener('click',()=>{state.offset+=1;renderDaily();});
fetch('/reading/reflections-2000.json',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(data=>{
  if(!data||data.total!==2000||!Array.isArray(data.cards)||data.cards.length!==2000)throw Error('Reflection dataset incomplete');
  cards=data.cards;for(const t of data.categories){const option=h('option',t);option.value=t;category.append(option);}
  renderDaily();renderList();
  window.setInterval(()=>{if(shanghaiDate()!==state.day){state.offset=0;renderDaily();}},60000);
}).catch(err=>{console.warn('Reflection cards unavailable:',err.message);daily.replaceChildren(h('p','思考卡片暂时无法加载，请稍后刷新。','ref-empty'));});
})();
