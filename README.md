# 私人导航工具箱 V19.88 稳定版

本项目使用 Cloudflare Pages + Pages Functions + D1 + Workers KV。

## 运行结构

- `cn/index.html`：导航主界面及前端同步控制器。
- `functions/api/data.js`：主 D1 数据 API、网站/分类 CRUD、版本冲突保护、KV 图标读写与维护。
- `functions/api/state.js`：管理员登录、会话和登录限流。
- `functions/api/wallpapers.js`：独立壁纸 D1 的列表、上传、选择和删除。
- `functions/api/wallpaper-image.js`：壁纸原图读取。
- `functions/_data/v17-seed.js`：仅在主 D1 尚未初始化时使用的初始数据。
- `assets/liquid-default-v19.57.png`：液态玻璃主题默认壁纸。
- `assets/runtime/`：从 HTML 内联数据中拆出的可缓存图片、字体和图标资源。
- `SYNC-AUDIT-REPORT.md`、`CLEANUP-REPORT.md`：同步审计与文件清理说明。

## Cloudflare Pages 绑定

生产环境必须配置以下绑定，变量名必须完全一致：

| 类型 | 变量名 | 用途 |
|---|---|---|
| D1 | `DB` | 网站、分类、收藏、排序、设置、备份和同步版本 |
| KV | `KV` | 自定义图标和自动 favicon 缓存 |
| D1 | `WALLPAPER_DB` | 壁纸元数据、当前壁纸指针和原图 |

环境变量/Secret：

- `NAV_USERNAME`
- `NAV_PASSWORD`
- `SESSION_SECRET`（建议使用至少 32 字节的随机密钥）

修改 Pages Functions 绑定后，需要重新部署，才能让生产函数使用新绑定。

## 同步行为

- 管理员在本机修改后，前端先写入本机持久化队列，再约 350ms 后提交主 D1。
- 主 D1 使用 revision 版本号和原子批处理保护并发写入；bootstrap 通过 first-primary session 与 revision 前后校验避免混合快照。
- 页面前台每 5 秒检查一次轻量 revision；发现其他设备更新后再拉取完整快照。
- 页面重新获得焦点、从后台恢复或网络恢复时，会主动检查云端版本。
- 网络超时不会清除本机待同步快照；请求会按超时和退避策略重试。
- 多设备需使用同一管理员账号。访客的收藏和最近访问记录保存在各自设备，不属于管理员云端同步数据。
- KV 是图标存储/缓存，不是网站主数据数据库。KV 的跨区域传播是最终一致的；主网站记录以 D1 为准。
- 壁纸数据保存在独立的 `WALLPAPER_DB`，与主导航 D1 分开同步。

## V19.88 重要变更

- 为 D1 API、登录 API、图标上传和壁纸 API 增加客户端超时保护。
- 增加网络失败指数退避，避免弱网络下每几秒无节制地重复请求。
- 页面恢复联网后，自动尝试安全恢复可合并的待同步快照；数据校验冲突仍需人工处理。
- 防止图标确认请求用云端完整快照覆盖请求期间产生的本机修改。
- 对 KV favicon 刷新使用版本化缓存键，避免旧 KV 边缘缓存内容被写入新版本 URL。
- KV 图标读取缓存 TTL 调整为 30 秒；新上传对象带创建时间元数据，维护任务会跳过 120 秒内的待提交对象，避免 D1 指针提交前误删 KV 对象。
- 拆分重复内联的图片/字体资源并启用长期静态缓存，减少主 HTML 约 480KB 原始体积。
- 移除未被运行时代码引用的旧版模板 CSS、JS、图片目录和嵌套候选 ZIP；保留实际使用的液态玻璃默认壁纸。

## 部署注意

1. 先保留原项目 ZIP 作为回滚副本。
2. 将本目录内文件覆盖到 GitHub 仓库根目录并提交。
3. 等待 Cloudflare Pages 生产部署成功。
4. 确认 `DB`、`KV`、`WALLPAPER_DB` 绑定仍指向原有资源；不要新建空数据库替代原数据库。
5. 首次访问会通过 `ensureSchema` 为现有 `sites_v17` 表添加一个可空的 `icon_cache_version` 列。此迁移只新增列，不重建、不清空现有表。
6. 部署后登录管理员账号，在两台设备分别打开同一生产域名，验证 D1 修改和图标同步。

本地模拟测试不能替代生产环境网络、Cloudflare 绑定和真实数据验证。部署后请先做少量测试，不要先执行批量清理或永久删除。
