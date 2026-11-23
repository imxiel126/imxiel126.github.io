# 知乎与小红书内容中心

页面地址：`/social/`。

## 发布原则
GitHub Pages 只能直接托管公开的静态内容。知乎和小红书不提供可供所有静态站点直接读取个人收藏/账号动态的通用公开接口，外站 iframe 也可能被平台安全策略拒绝；因此本站采用 **公开内容卡片 + 原文链接** 模式。本站不会收集登录口令、Cookie 或私密笔记，也不会通过未经授权的抓取接口同步数据。

## 关联个人主页
编辑 `social/data.json` 内的 `profiles.zhihu.url` 与 `profiles.xiaohongshu.url`，填写各自**公开主页的 HTTPS 链接**，也可以填写公开昵称。留空时只跳转到平台首页。

## 添加公开作品
在 `items` 数组中添加条目：
```json
{
  "platform": "zhihu",
  "type": "回答",
  "title": "这里是你拥有分享权的公开作品标题",
  "summary": "你自行撰写或有权使用的摘要",
  "url": "https://www.zhihu.com/question/...",
  "cover": "",
  "tags": ["氢能", "科研方法"],
  "published": "2026-11-23",
  "public": true
}
```
`platform` 只能是 `zhihu` 或 `xiaohongshu`；URL 必须是对应平台的 HTTPS 链接，`public: true` 表示已主动授权对外展示。外站文章图片可能有防盗链，不能保证封面显示，建议为空或使用自己有权分享的公开图片地址。

请勿上传未经授权的全文、私人收藏、登录凭据或 Cookie。详情和互动始终跳转回源平台。

## 技术
纯静态页面，无需额外账号授权或后端服务。前端在加载 `data.json` 后执行分类、检索与排序。需要真正的自动更新时，应根据平台提供的**官方或合法授权的数据接口**，单独实现一个只导出已授权公开内容的 GitHub Actions 工作流。
