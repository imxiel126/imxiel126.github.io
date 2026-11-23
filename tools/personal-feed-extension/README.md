# 知乎 / 小红书真实推荐页浏览器同步（可选）

> 已核实 GitHub 仓库曾收到浏览器同步的推荐卡片；本机是否持续运行取决于扩展是否启用、登录状态和实际浏览的推荐页面。  
> 本工具不使用搜索、热榜或话题词条假装是登录用户的推荐页。

## 工作原理

1. 浏览器插件只在你本人浏览知乎首页「推荐」或小红书首页「推荐」时读取**页面已显示**的公开卡片标题、链接及可见的短摘要。
2. 只在你明确同意公开展示并启用同步之后，才把这些卡片通过 GitHub API 保存到 `social/personal-feed.json`。
3. GitHub Pages 自动部署；首页从 `social/personal-feed.json` 展示内容，并每 5 分钟重新拉取最新同步文件。

浏览器没打开、没有登录、没访问推荐页、网站变更 DOM 或平台阻止相关内容读取时，**不会产生新数据**，也不会伪造内容。无法承诺实时或 24 小时运行。

## 启用所需的一次性操作

1. 下载此 GitHub 仓库的 ZIP 并解压。Chrome 打开 `chrome://extensions/`，启用「开发者模式」，点击「加载已解压的扩展程序」，选择 `tools/personal-feed-extension` 文件夹。
2. 在 GitHub 的 [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new) 创建**仅限**仓库 `imxiel126/imxiel126.github.io` 的 token，只给 **Contents: Read and write**（其他权限保持最低）。不要创建全账号权限 token。
3. 打开扩展程序设置，填入仓库和 token，并勾选公开展示授权与启用自动同步。
4. 已登录状态打开 [知乎推荐](https://www.zhihu.com/) 或 [小红书推荐](https://www.xiaohongshu.com/explore?channel_id=homefeed_recommend)，浏览推荐卡片；插件会自动尝试采集并提交，每次成功提交后 GitHub Actions 发布。返回 [GitHub Pages 首页](https://imxiel126.github.io/) 查看已同步卡片。

## 重要隐私说明

- 个人推荐反映你的兴趣和阅读偏好。一旦写入公开仓库，别人就可以查看，且历史 Git 版本可能留存；**不是私有备份**。
- 插件不读取密码、Cookie、私信、收藏或点赞记录，也不会将 GitHub token 放入网页代码、仓库或外部平台。Token 只存于安装浏览器的本机扩展存储，仅用于访问 GitHub API。
- 禁用扩展、清理本地存储、撤销 token 可停止后续同步。若要删除已公开数据，还需从仓库删除 `social/personal-feed.json` 中的卡片；既往 Git 历史仍可能保留。
- 此为浏览器 DOM 层面的实验性方案，没有承诺任何平台接口兼容；当平台变更页面或要求开发者授权时，需要调整适配。
- 不得用于绕过登录、验证码或风控。不应使用第三方账号的 Cookie，也不要将账号凭据提交到 GitHub。

## 技术支持

- `manifest.json`：Chrome / Edge Manifest V3 配置。
- `content.js`：在用户实际浏览推荐页时从可见 DOM 提取卡片。
- `background.js`：本地去重、合规校验、限频和 GitHub Contents API 写入。
- `popup.html` / `popup.js`：一次性授权开关、仓库和 token 设置、手动同步。

## 2026-11-23 同步可靠性修复

- 已修复首页脚本把真正推荐流移到新闻末尾、折叠隐藏的问题；首页可直接跳转 `/#personal-recommendations`。
- 版本 0.1.1 增加浏览器 `alarms` 权限：若新推荐因十分钟写入限频未立即上传，将在浏览器保持运行的条件下计划后续刷新。浏览器退出后依旧不保证持续采集或同步。
- **已在浏览器安装旧版的用户**：从仓库更新扩展文件后，在 `chrome://extensions/` 点击该扩展的“重新加载”，让新版本生效。不要把 Token 填入 GitHub 文件或发送给他人。
