"use strict";
const $=id=>document.getElementById(id);
async function load(){
 const d=await chrome.storage.local.get(["enabled","confirmedPublic","repository","githubToken","observed","lastSynced","lastError"]);
 $("repo").value=d.repository||"imxiel126/imxiel126.github.io";
 $("token").value=d.githubToken||"";
 $("enabled").checked=!!d.enabled;
 $("consent").checked=!!d.confirmedPublic;
 $("status").textContent="已捕获 "+(d.observed?.length||0)+" 条；"+(d.lastSynced?"最近同步："+new Date(d.lastSynced).toLocaleString("zh-CN"):"尚未同步")+(d.lastError?"；错误："+d.lastError:"");
}
$("save").onclick=async()=>{
 const approved=$("consent").checked,enabled=$("enabled").checked;
 if(enabled&&!approved){$("status").textContent="启用前必须确认公开展示风险";return}
 await chrome.storage.local.set({repository:$("repo").value.trim(),githubToken:$("token").value.trim(),
 confirmedPublic:approved,enabled:enabled&&approved});
 $("status").textContent="设置已保存。打开知乎/小红书的推荐页后，页面将自动采集推荐卡片。";
};
$("sync").onclick=()=>chrome.runtime.sendMessage({type:"syncNow"},res=>{
 $("status").textContent=res?.status==="synced"?"已同步 "+res.count+" 条至 GitHub，随后等待 Pages 部署。":"同步状态："+JSON.stringify(res||{});
});
load();