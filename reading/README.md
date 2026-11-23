# 微信读书阅读中心

网址：https://imxiel126.github.io/reading/

## 开启步骤

1. 官方授权入口：https://weread.qq.com/r/weread-skills
2. 在仓库 **Settings → Secrets and variables → Actions** 中：
   - 添加 Repository secret `WEREAD_API_KEY`（`wrk-` 开头）
   - 明确接受公开阅读偏好后添加 Repository variable `WEREAD_PUBLIC_ENABLED` = `true`
   - 可选添加 Repository secret `OPENAI_API_KEY` 启用 AI 导读（产生独立 API 费用）
3. 进入 **Actions → 微信读书阅读中心自动同步 → Run workflow** 首次运行。
4. 后续每天约北京时间 09:15 自动更新，GitHub Actions 定时触发可能延后。

## 发布范围

**默认关闭。** 开启后公开非私密书架条目、最近最多 40 本电子书的阅读进度、笔记数量、汇总时长和偏好。
笔记正文**默认不公开**；在 `reading/public-notes.json` 的 `publicNoteBookIds` 列表中加入特定 bookId，
才公开对应书籍最多三段短笔记或划线。书签只统计数量，不包含正文。
API Key 仅作为 Actions secret，永远不要写入前端代码或 commit。

AI 导读仅基于公开的书籍简介和获准公开的个人想法，不能视作完整书籍摘要。
停止更新可删除变量；已经公开的数据也应从 Git 历史、站点产物和第三方缓存中核查清理。

技术依赖：腾讯官方 WeRead Agent API Gateway，Skill version 1.0.6。

## GitHub Pages 发布来源

本站的每日新闻工作流和阅读同步工作流都使用 `actions/deploy-pages@v4` 主动发布。
如果 Pages 页面还设置为 **Deploy from a branch**，请在
**Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。
不要选择 GitHub 的默认 Jekyll 模板；本仓库已经有自己的发布工作流。
发布脚本同时包含 `archive`、`notes`、`reading` 和 `library`，避免覆盖现有栏目。

首次同步若显示 **skipped**，检查 Repository variable `WEREAD_PUBLIC_ENABLED` 是否严格等于小写 `true`；
若同步报错 `Missing WEREAD_API_KEY`，检查是否把密钥存入 **Repository secret** 而非 Variable。
请先审核公开数据范围：非私密书架条目、阅读进度、读书笔记数量和阅读统计会进入公开 Git 历史，不能视为私密备份。

## 书籍知识卡（自动增强）

页面会为公开书架分批补充书籍内容介绍、出版社、微信读书评分、精选短句（热门划线）、公开推荐点评、核心关键词和词汇释义。点击书架中的“查看知识卡”可以展开详情；搜索也支持简介、关键词和专业术语。

数据来源：腾讯微信读书官方 Agent API Gateway（`/book/info`、`/book/bestbookmarks`、`/review/list`）。每本书最多展示 **一条不超过 64 字**的公开热门短句和**一条不超过 82 字**的公开读者评论，避免大段转载。公开评论与个人笔记严格区分；书籍简介为原接口短介绍，并不表示已阅读原书全文。

默认每次为 **10 本**尚未完善的电子书抓取知识卡，首次不会一次性完成全部书架。可在 Actions 的 Repository variable 中设定 `WEREAD_ENRICH_BATCH`（1～16）调节单次数量；数据会缓存并按约 90 天刷新。专业术语取自本项目的人工释义词表：只有该术语确实出现在书名或公开简介中时才显示，不会把它误当作书中已讲解的知识。AI 导读仍然需要单独的 `OPENAI_API_KEY`，且不应据此声称已分析整本书。
