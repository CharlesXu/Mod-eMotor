# Mod-eMotor · 电改模拟工具

电动车姿态与改装参数模拟网站。项目包含车型选择、车辆线稿、悬架与车轮参数调整、坐姿模拟、图层显示和参数保存功能。

这是一个独立的网站源码仓库，不包含网站克隆技能、Agent 配置、抓取脚本或研究资料。运行时不需要激活码、账号、数据库或外部 API。

## 环境要求

- Git
- Node.js 24
- npm（随 Node.js 安装）

项目可在 Linux、macOS 和 Windows 上运行。

## 下载并启动

```bash
git clone https://github.com/CharlesXu/Mod-eMotor.git
cd Mod-eMotor
npm ci
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

Linux 或 macOS 使用 `nvm` 时，可以先执行：

```bash
nvm install
nvm use
```

Windows 用户可在 PowerShell 中直接执行相同的 `npm` 命令。

### Linux 出现 `next.config.ts is not supported`

本项目通过 `package-lock.json` 固定使用支持 TypeScript 配置文件的 Next.js 16。正常情况下应先运行 `npm ci`，不要跳过依赖初始化，也不需要每次强制升级到 `latest`。

如果曾经使用过旧版依赖，请清理本地安装后重新初始化：

```bash
rm -rf node_modules .next
npm ci
npm run dev
```

确认项目实际使用的 Next.js 版本：

```bash
npx next --version
```

只有在你明确希望把项目升级到最新框架版本时，才执行下面的命令。它会修改本机的 `package-lock.json`：

```bash
npm install next@latest react@latest react-dom@latest eslint-config-next@latest
npm run dev
```

## 生产环境运行

```bash
npm ci
npm run build
npm run start
```

默认地址为 [http://localhost:3000](http://localhost:3000)。按 `Ctrl+C` 停止服务。

### 修改端口

Linux 或 macOS：

```bash
PORT=8080 npm run start
```

Windows PowerShell：

```powershell
$env:PORT=8080
npm run start
```

Windows Command Prompt：

```bat
set PORT=8080 && npm run start
```

## Docker 部署

安装 Docker Desktop 后，在项目目录执行：

```bash
docker compose up --build -d
```

访问 [http://localhost:3000](http://localhost:3000)。查看日志或停止服务：

```bash
docker compose logs -f app
docker compose down
```

使用其他端口：

```bash
PORT=8080 docker compose up --build -d
```

Windows PowerShell：

```powershell
$env:PORT=8080
docker compose up --build -d
```

## Standalone 部署

构建后，Next.js 会生成精简的 `.next/standalone` 服务目录：

```bash
npm ci
npm run build
```

Linux 或 macOS：

```bash
mkdir -p .next/standalone/public .next/standalone/.next/static
cp -R public/. .next/standalone/public/
cp -R .next/static/. .next/standalone/.next/static/
cd .next/standalone
node server.js
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force .next/standalone/public | Out-Null
New-Item -ItemType Directory -Force .next/standalone/.next/static | Out-Null
Copy-Item -Recurse -Force public/* .next/standalone/public
Copy-Item -Recurse -Force .next/static/* .next/standalone/.next/static
Set-Location .next/standalone
node server.js
```

## 检查项目

```bash
npm run check
```

该命令依次运行脱敏与安全检查、自动化测试、ESLint、TypeScript 检查和生产构建。

只运行自动化测试：

```bash
npm test
```

只运行脱敏与安全检查：

```bash
npm run security
```

该检查包含 Git 跟踪文件中的私钥、常见令牌、硬编码凭据和个人绝对路径检查，以及高危依赖漏洞审计。检查结果只报告文件、行号和规则，不输出疑似敏感值。

## 目录结构

```text
src/app/                    页面入口与全局样式
src/components/motomate/    模拟器界面与几何计算
src/data/                   车型和机械参数数据
public/motomate/            车辆图片、线稿与控件素材
```

## 说明

- 本工具用于车辆姿态、尺寸和改装方案的可视化比较。
- 对公网部署时，建议使用带 HTTPS 的反向代理。
- 车型名称、品牌标识、车型参数及相关视觉素材的权利归原作者或各自权利人所有。

## License

本项目中由 CharlesXu 原创并有权许可的代码采用 [MIT License](LICENSE)。`public/motomate/**`、`src/data/**` 以及其他第三方名称、商标、图片、线稿、控件素材和数据不在该 MIT 授权范围内，除非对应文件另有明确许可。详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 鸣谢

1. [SenZQ](https://space.bilibili.com/524313494)：其电鸡模拟器网站是本项目最重要的功能与交互参考，也是车型图片、车辆线稿、控件素材和部分车型数据的重要资源来源。感谢 SenZQ 的原创工作与长期资源积累；可参阅其[电鸡姿态模拟工具公开演示](https://www.bilibili.com/video/BV1pi421v7qM/)。

本项目参考上述网站的公开功能与交互，使用 TypeScript、React 与 Next.js（Node.js 工具链）重新实现应用代码，但不声明为 Clean room 实现。仓库包含来自或参考 SenZQ 工具及其他公开资料的资源与数据，且没有 Clean room 所需的人员隔离、独立规格和完整来源审计记录。致谢不构成所有权、授权或再许可声明；第三方资源不受本项目 MIT License 授权，详细边界见 [第三方资源说明](THIRD_PARTY_NOTICES.md)。
