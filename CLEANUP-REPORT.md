# V19.89 文件清理报告（沿用 V19.88 清理结果）

本次以运行时代码的静态引用为依据清理；没有按文件大小盲删。

## 从可部署项目中移除

| 路径 | 文件数 | 原始大小 | 判断 |
|---|---:|---:|---|
| `assets/css/` | 48 | 约 3.11 MB | 主页面没有引用；当前 CSS 已内嵌在 `cn/index.html` |
| `assets/js/` | 9 | 约 0.32 MB | 主页面没有引用；当前运行脚本已内嵌在 `cn/index.html` |
| `assets/images/` | 253 | 约 3.76 MB | 当前页面和 Functions 没有引用；网站图标由 KV/API 提供 |
| `assets/webstack_logos.sketch` | 1 | 约 6.55 MB | 原始设计源文件，不参与网站运行 |
| `nav_v1928_modular_candidate.zip` | 1 | 约 1.89 MB | 项目根目录中的嵌套候选压缩包，不参与部署 |

上述文件均未被当前 HTML、CSS、JS、Pages Functions 或种子数据引用。原始上传 ZIP 未被修改，仍包含这些源文件；本稳定版只是不再把它们带入生产部署目录。

## 保留的资源

- `assets/liquid-default-v19.57.png`：液态玻璃主题实际引用的默认壁纸。
- `assets/runtime/`：从主 HTML 拆出的品牌图、favicon、字体和背景图，使用内容哈希命名并设置一年 immutable 缓存。
- `functions/`、`cn/index.html`、`404.html`、语言入口、`CNAME`、`LICENSE`：继续保留。

## 清理效果

- 原 ZIP：约 18.10 MB、330 个文件。
- 稳定版目录：约 2.29 MB、27 个文件。
- 减少约 15.81 MB（约 87.3%）。
- 主 HTML 原始体积减少约 477 KB。

这项清理减少仓库和部署包体积；它不会自动修复家庭宽带到 Cloudflare 的路由故障。


V19.89 仅增加本版变更与验证说明，并修复前端主题样式和 D1 重复检测逻辑；未增加运行时图片、字体或第三方库。