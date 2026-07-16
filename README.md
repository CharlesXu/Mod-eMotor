# Mod-eMotor · 电改模拟工具

电动车姿态与改装参数模拟网站。项目包含车型选择、车辆线稿、悬架与车轮参数调整、坐姿模拟、图层显示和参数保存功能。

这是一个独立的网站源码仓库，不包含网站克隆技能、Agent 配置、抓取脚本或研究资料。运行时不需要激活码、账号、数据库或外部 API。

在线版本：[https://charlesxu.github.io/Mod-eMotor/](https://charlesxu.github.io/Mod-eMotor/)

## GitHub Pages 自动部署

推送到 `main` 分支后，[Deploy GitHub Pages](.github/workflows/deploy-pages.yml) 会自动完成依赖安装、代码检查、静态构建和发布。

部署地址：

```text
https://charlesxu.github.io/Mod-eMotor/
```

也可以在 GitHub 仓库的 **Actions → Deploy GitHub Pages → Run workflow** 手动重新部署。

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

该命令依次运行 ESLint、TypeScript 检查和生产构建。

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
- 车型名称、品牌标识及相关视觉素材的权利归各自权利人所有。
