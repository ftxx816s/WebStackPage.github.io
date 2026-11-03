# V19.88 同步审计报告

## 结论

源码采用 D1 作为主导航数据源、KV 作为图标对象/缓存、独立 WALLPAPER_DB 作为壁纸数据源。D1 使用 revision guard + batch 事务防止旧设备覆盖较新的云端版本；bootstrap 通过 `withSession("first-primary")` 和 revision 前后核对，避免并发写入期间返回混合快照。前端本地保存待同步快照，约 350ms 后推送；前台设备每 5 秒检查 revision，发现变化后读取最新快照。

因此这是准实时轮询同步，不是 WebSocket 推送，也不是每次 KV 写入都能立即在所有 Cloudflare 边缘位置可见。

## 已识别并修复

1. D1 请求没有客户端超时：弱网络时 `syncing` / `pullInFlight` 可能长时间不释放。
2. 同步请求失败后没有退避：在 Cloudflare 路由异常时，可能每 5 秒重复探测。
3. 图标确认流程无条件应用完整 bootstrap，可能覆盖图标上传期间发生的其他本机修改。
4. 离线时恢复出的可合并冲突快照，网络恢复后不会主动再次尝试安全恢复。
5. 图标刷新使用稳定 KV key，可能被旧边缘缓存返回；改为独立版本键。
6. KV 维护清理没有刚写入对象的保护期；增加 `createdAt` 元数据和 120 秒保护期。
7. 壁纸 D1 请求和图片预加载没有超时，轮询失败时无退避。
8. pagehide keepalive 没有检查浏览器 keepalive 请求体预算；增加 60KB 上限，超限时不取消本机队列。
9. 删除了未被运行时代码引用的旧版静态模板目录和嵌套候选 ZIP。

## 本地集成测试

- 管理员登录和 D1 bootstrap
- 网站修改、收藏写入和新 bootstrap 回读
- 自定义分类和自定义网站新增
- 网站修改、软删除、恢复和永久删除
- stale revision 被拒绝且不覆盖新数据
- KV 自定义图标上传、读取、重置及对象删除
- 两个并发快照使用相同 base revision 时，只允许一个提交，另一个返回 revision conflict

初始 seed 测试数据：191 个网站、20 个分类。该数字不是线上数据库实际数量。

## 未能在本地证明的事项

- 生产 Cloudflare Pages 是否绑定了正确的 `DB`、`KV`、`WALLPAPER_DB`。
- 线上 D1 是否有 240 个或其他数量的网站、分类及完整设置。
- 线上 KV 中每个图标对象是否都存在。
- 家庭宽带到 Cloudflare 的国内链路质量。
- 不同真实设备、真实浏览器的生产部署表现。

## 数据安全

本版本不删除或重建任何 D1 用户数据表。新增 `sites_v17.icon_cache_version` 可空列。旧 `nav_state` / `nav_backup` 表若存在会保留，不执行 DROP。
