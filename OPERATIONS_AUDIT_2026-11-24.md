# 知行手记 GitHub 全盘审计｜2026-11-24

> 范围：`imxiel126/imxiel126.github.io` 的动态数据与 GitHub Actions；另核查已连接的学习仓库与私有备份仓库。该审计是时间点快照，不能替代后续跨日真实运行记录。

## 已修复

- 修复发布步骤过快造成的 Pages artifact 查找失败：统一发布保留产物索引等待，并使用唯一构建产物名称。
- **单一发布入口**：`.github/workflows/social-pages.yml`（现名“个人网站全站统一发布”）负责整站部署；所有手工内容变更、上游新闻/科研/微信读书等数据工作流成功完成后触发，并每 3 小时尝试补偿发布。
- `daily.yml`、`research-sync.yml`、`weread.yml` 只获取和保存数据，不再互相竞争 Pages 队列；`notes-pages.yml` 验证人工审核的公开笔记，不再单独发布。
- 修复健康检查 `scripts/check_site_integrity.py` 与新架构不一致造成的误报，并将全站结构校验纳入统一发布。
- 健康监测还核对早间专题邮件的运行次数（需只读 Actions 授权），及脑图、学习台、阅读、笔记、社交、研究、随手记等页面入口。
- 微信读书并发更新使用 `scripts/merge_weread_public.py` 保留已查询的公共知识卡，并不会恢复隐藏书籍和未授权私人摘录。

## 模块实际情况

| 模块 | 动态行为 | 已知限制 |
| --- | --- | --- |
| 新闻晨读 | 07:37 生成前夜归档、08:47 补偿 | 实时源依赖央视页面；GitHub cron 非准点承诺 |
| 主页和氢能晨报邮件 | 07:10、07:20 计划发送 | 审计时没有足够当天定时成功记录；健康检查会在 11:44 后识别 |
| 微信读书 | 09:17、11:47 计划查询；已有 239 条公开书架 | API 延迟可能影响抓取；AI 摘要当前 0 条，需核实可选模型凭证 |
| 阅读思考 | 2000 条原创练习，页面按北京时间换日轮换 | 每日轮换的是已有内容，并非每天生成全新 2000 条 |
| 知识库 | 书目、引用和观点卡各 1000 条，页面按日期轮换 | 静态库并非每天从外部自动新增 |
| 研究 | 每 6 小时拉取公开来源，数据变更才保存 | 若上游无新内容，本地同步成功也可能不改变日期 |
| 社交推荐 | 已授权浏览器扩展抓取后更新公开推荐快照 | 不能单靠 GitHub Actions 读取知乎、小红书私人个性化推荐 |
| 私人第二大脑/学习台 | `localStorage` 本地读写、手动导入导出 | 不会在手机与电脑间自动同步；清缓存可能丢记录 |
| 随手记 | 本地记录，显式审核后可向公开仓库上传 | 默认不会把私人想法自动公开；目前公开数据为空 |
| 精选笔记 | 白名单审核后可公开 | 当前 `notes/data.json` 无公开条目；不是印象笔记完整同步 |
| 阅读每日邮件 | 22:07、22:37 补偿，SMTP 发信 | 成功提交 SMTP ≠ 收件箱最终到达；有当日发送标记防重复 |
| 全站健康检查 | 11:44 和 23:44，北京时间 | 定时检查同样依赖 GitHub；成功的 push 自检不代表 scheduled 运行已验证 |

## 其他仓库

- `imxiel126/xiel-study` 当前是空仓库，没有学习数据和自动同步。
- `imxiel126/yinxiang-notes-backup` 为私有仓库，具有备份清单与试点核验文件；**GitHub 远端尚未包含全部笔记原件和大量附件**。详见私有仓库 README 的当前状态说明。不要将私有笔记文件复制到公开网站仓库。

## 运维入口

- [GitHub Actions](https://github.com/imxiel126/imxiel126.github.io/actions)
- [统一发布工作流](https://github.com/imxiel126/imxiel126.github.io/actions/workflows/social-pages.yml)
- [每日健康检查](https://github.com/imxiel126/imxiel126.github.io/actions/workflows/daily-health.yml)
- [微信读书同步](https://github.com/imxiel126/imxiel126.github.io/actions/workflows/weread.yml)
- [早间专题邮件](https://github.com/imxiel126/imxiel126.github.io/actions/workflows/editions.yml)

**判断标准**：只有出现了下一次定时触发记录，且该运行成功、数据日期正确、网站能访问、邮件已确认收信，才能宣称对应功能持续自动更新。频繁的短时间提交可能使同一个部署队列的中间一次排队运行显示 `cancelled`，应以最新成功发布和完整链路为准。
