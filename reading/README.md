# 微信读书阅读中心

网址：https://imxiel126.github.io/reading/

## 开启步骤

1. 官方授权入口：https://weread.qq.com/r/weread-skills
2. 在仓库 **Settings → Secrets and variables → Actions** 中：
   - 添加 Repository secret `WEREAD_API_KEY`（`wrk-` 开头）
   - 明确接受公开阅读偏好后添加 Repository variable `WEREAD_PUBLIC_ENABLED` = `true`
   - 可选添加 Repository secret `OPENAI_API_KEY` 启用 AI 导读（产生独立 API 费用）
3. 进入 **Actions → 微信读书阅读中心自动同步 → Run workflow** 首次运行。
4. 后续每天计划北京时间 09:17 更新，并在 11:47 追加一次补偿同步，GitHub Actions 定时触发可能延后。

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

首次运行会优先补齐当前公开书架中缺失的书籍基础介绍（单轮最多 239 本，实际以接口可用内容为准）；公开热门短句和读者评论则每轮检查最多 24 本，后续定时继续补充。可在 Actions 的 Repository variables 中设定 `WEREAD_INTRO_BATCH`（1～250）及 `WEREAD_DISCUSSION_BATCH`（1～32）调整。已获取的简介会缓存，并在约 90 天后刷新。若微信读书没有返回书籍介绍或合适的简短评价，网站会明确显示资料暂缺，不编造内容。专业术语取自本项目的人工释义词表：只有该术语确实出现在书名或公开简介中时才显示，不会把它误当作书中已讲解的知识。AI 导读仍然需要单独的 `OPENAI_API_KEY`，且不应据此声称已分析整本书。

## 阅读思考：2000 条动态轮换

- 数据：`reading/reflections-2000.json`，包含 **2000 条**原创、问题导向的阅读思考卡，分成 10 类。
- 页面：`reading/index.html`，`reading/reflections.js`，`reading/reflections.css`。
- 每天按北京时间日期固定轮换 6 条，打开页面时自动选取；即使 GitHub Actions 偶尔延迟，也不会影响当天更换。网页长期打开时会检查日期切换。
- 所有卡片支持关键词搜索、分类、分页查看以及主动“再换一批”。这些卡片不是书中原文、名人名言或真实读者评论。

## 每日私人阅读邮件

- 触发方式：`.github/workflows/weread-mail.yml`；每天 UTC 14:07 和 14:37，即北京时间 **22:07** 和 **22:37 补偿运行**。也支持手动运行；GitHub Actions 定时触发可能延迟。
- 只使用原有的 `WEREAD_API_KEY` 与 `SMTP_HOST`、`SMTP_USER`、`SMTP_PASSWORD` Repository Secrets。收件人从 `WEREAD_MAIL_TO` Secret 读取，未设置时回退到 `MAIL_TO` Secret；脚本会核对收件地址是否与事先明确指定的邮箱一致，不会误发到别处。邮箱明文不保存在公开仓库。
- 内容：当天阅读/收听**总时长**（来自 `/readdata/detail` 的本周每日分桶，单位秒）；书架中当天最后阅读时间有记录的书籍（最多详细列出 6 本）、官方简要内容介绍和主题词、简短公开热门划线、简短公开读者评论；对于个人新划线，只取当天创建的少量短摘录用于发送到本人邮箱。
- **重要口径**：官方此接口没有提供“今天各本书精确阅读时长”；邮件不将全周时长或某本累计时间误写为今天的每本书时长。当天总时间仅截至发送时（22:00 左右），不包含之后阅读。
- 安全：不提交邮件正文、个人划线、阅读历史详情或收件人地址到 GitHub。GitHub 只保存空文件 `.sent/weread-mail-YYYY-MM-DD` 防止当日重复发送。
- 禁用方式：在 GitHub Actions 禁用该 workflow，或移除 `WEREAD_MAIL_TO` / `MAIL_TO` 与相关 SMTP 密钥。直接编辑计划时间需要了解 UTC 时区。
- 失败排查：运行记录中的 `Recipient secret missing or does not match...` 表示需要在 Actions Secrets 中正确配置 `WEREAD_MAIL_TO`；SMTP 错误表示需要检查现有邮件发信授权码。

## 自动更新可靠性与故障提醒（2026-11-23）

**真正每日变化的内容**：微信读书公开书架、统计与知识卡由 Actions 同步；阅读思考库的 2000 条原创卡片在访问网页时按北京时间日期自动轮换，不需要每天把相同数据重新提交 GitHub。

- `reading` 每日主运行 09:17，补偿运行 11:47。每次会自动合并 GitHub 上已有的更完整知识卡，避免并发写入丢失。
- 阅读私人邮件每天计划 22:07，22:37 补偿运行。若已存在当日发送标记则跳过第二次发送。
- 新闻联播晨读每天计划 07:37，08:47 补偿运行。
- 研究资料每 6 小时轮询。页面发布产物名称含 GitHub run ID + attempt，以减少重复产物冲突。
- `.github/workflows/daily-health.yml` 每天北京时间 11:44 和 23:44 核查阅读数据时间、最近一日新闻归档、2000 条思考卡轮换程序、研究同步时间、晚间邮件标记及线上访问；故障尝试向指定邮箱发送提醒，不发布私人内容。
- GitHub Actions 的 schedule 是**尽力执行**，官方允许延迟、偶尔跳过；公开仓库超过 60 天无活动时计划任务可能被停用。健康检查本身也依赖 GitHub，不能替代独立的第三方可用性监控。
- 知乎、小红书个性化推荐流来自一次性授权浏览器数据的页面抓取，不等于平台官方自动 API；不能承诺每日自动刷新登录态推荐流。可随时打开对应平台查看实时推荐。

查看：https://github.com/imxiel126/imxiel126.github.io/actions
