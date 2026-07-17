# iPhone 交互修复规格

## 目标

390×844 的 iPhone Safari 访问本地开发服务器或静态部署时，品牌目录、配件和鸣谢均可见、可操作、可关闭。

## 实现约束

- `next.config.ts` 根级使用官方字段 `allowedDevOrigins`。
- 自动收集本机非内部 IPv4 地址，并允许通过 `NEXT_ALLOWED_DEV_ORIGINS` 追加主机名/IP；条目不包含协议或端口。
- 信息面板使用条件渲染的 `position: fixed` 覆盖层和 `role="dialog"`，不使用原生 `<dialog>`。
- 打开时锁定 `document.body` 滚动，关闭时恢复；Escape、遮罩和关闭按钮均可关闭。
- 覆盖层 `z-index` 高于品牌栏、车型目录和右上工具栏。
- 品牌按钮保持普通 `button`，点击后车型目录必须占据 `left: 84px` 到视口右侧的可视区域。

## 验收

- 390px 视口点击 YADEA、NIU、Honda、ninebot 均显示各自车型。
- 打开配件/鸣谢后覆盖层矩形在视口内，标题和关闭按钮可见。
- 关闭覆盖层后品牌和车型交互继续正常。
- 用局域网 IP 启动开发服务器时不再出现 `/_next/webpack-hmr` 跨域拦截。
