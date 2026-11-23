/* Readable news: progressive enhancement; without JS, full reports remain visible. */
(()=>{"use strict";
const ready=()=>{const main=document.querySelector("main");if(!main)return;
const items=[...main.querySelectorAll(":scope > section")];
const skip=new Set(["全期速览","本期节目","往期","本期提要","相关联想","逐条回看"]);
const candidates=items.filter(s=>{const h=s.querySelector(":scope > h2");return h&&!skip.has(h.textContent.trim());});
if(!candidates.length)return;
candidates.forEach((section,i)=>{
  const heading=section.querySelector(":scope > h2");const title=heading.textContent.trim();
  const detail=document.createElement("details");
  const summary=document.createElement("summary");
  const number=document.createElement("span");number.className="report-index";number.textContent=String(i+1).padStart(2,"0");
  const titleSpan=document.createElement("span");titleSpan.className="report-title";titleSpan.textContent=title;
  const toggle=document.createElement("span");toggle.className="report-toggle";toggle.textContent="展开 ＋";
  summary.append(number,titleSpan,toggle);
  const body=document.createElement("div");body.className="report-body";
  heading.remove();
  while(section.firstChild)body.append(section.firstChild);
  detail.append(summary,body);
  detail.addEventListener("toggle",()=>{toggle.textContent=detail.open?"收起 −":"展开 ＋"});
  section.classList.add("report");section.id="report-"+(i+1);section.append(detail);
});
const overview=items.find(s=>s.querySelector(":scope > h2")?.textContent.trim()==="全期速览");
if(overview){
  overview.id="overview";
  const list=overview.querySelector("ol");
  if(list){[...list.children].forEach((li,i)=>{
 const strong=li.querySelector("strong");if(!strong||!candidates[i])return;
 const existing=strong.querySelector("a[href]");
 if(existing){
   existing.target="_blank";existing.rel="noopener noreferrer";
 }else{
   const a=document.createElement("a");a.href="#report-"+(i+1);a.textContent=strong.textContent;strong.replaceWith(a);
 }
 if(!li.querySelector(".news-detail-link")){
   const expand=document.createElement("a");expand.href="#report-"+(i+1);expand.className="news-detail-link";expand.textContent="本站整理";
   li.append(" · ",expand);
   expand.addEventListener("click",()=>{const d=candidates[i].querySelector("details");if(d)d.open=true;});
 }
});}
}
const first=candidates[0];
const bar=document.createElement("div");bar.className="news-actions";
const button=(label,expanded)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",()=>candidates.forEach(s=>{s.querySelector("details").open=expanded}));return b;};
bar.append(button("展开全部报道",true),button("收起全部",false));
main.insertBefore(bar,first);
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready();
})();