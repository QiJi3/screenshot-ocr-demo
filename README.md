[English](README_EN.md) | 简体中文

# Screenshot OCR Demo

基于 Electron + FastAPI + PaddleOCR 的离线桌面截图 OCR 工具。
本项目为技术验证 Demo，展示本地端侧大模型集成与桌面应用架构。

## ⬇️ 下载

前往 **[Releases](https://github.com/QiJi3/screenshot-ocr-demo/releases)** 获取最新版本：
- **便携版 (.zip)**：免安装，解压即用。
- **安装版 (.exe)**：标准 Windows 安装向导。

## ✨ 特性

- **秒级响应**：引入 `loading.html` 配合 Electron 预加载，主界面瞬间开启，OCR 引擎在后台异步加载（耗时约 4-6s）。
- **独立运行**：后端使用 PyInstaller 打包为 `backend.exe`，完全脱离本地 Python 环境。
- **本地存储**：截图记录与 SQLite 数据库存储于系统 AppData 目录，无权限冲突风险。
- **实时通信**：借助 Server-Sent Events (SSE) 流式返回 OCR 解析进度与结果。

## 🚀 快速上手

### 普通用户
1. 下载 Release 压缩包或安装程序并运行。
2. 使用快捷键或点击按钮截图，等待毫秒级离线识别结果。

### 开发者部署

**环境要求**
- Node.js (v18+)
- Python 3.10+
- pnpm

**1. 拉取代码**
```bash
git clone https://github.com/QiJi3/screenshot-ocr-demo.git
cd screenshot-ocr-demo
```

**2. 前端依赖**
```bash
pnpm install
```

**3. 后端环境**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
cd ..
```

**4. 启动开发服务**
```bash
pnpm run dev
```

**5. 构建打包**
```bash
pnpm run build
```
产物将输出至 `dist/` 目录（包含独立可执行文件及资源）。

## 📂 目录结构

```text
screenshot-ocr-demo/
├── .github/                  # CI/CD 自动化构建
├── backend/                  # Python 后端
│   ├── main.py               # FastAPI 服务
│   ├── ocr_engine.py         # PaddleOCR 封装
│   ├── backend.spec          # PyInstaller 配置
│   └── dist_backend/         # (构建后) 独立可执行文件
├── src/                      # Electron 源码
│   ├── main/                 # 主进程 (包含子进程调度)
│   ├── renderer/             # 渲染进程 (Vue/React UI)
│   └── loading.html          # 极速启动屏
└── package.json
```

## 🔌 API 接口

默认本地端口 `8000`：

| Endpoint | Method | 描述 |
| --- | --- | --- |
| `/api/ocr` | `POST` | 提交截图进行识别 |
| `/api/status` | `GET` | 检查后端引擎状态 |
| `/api/history` | `GET` | 查询历史识别记录 |

### SSE 进度格式

```http
event: progress
data: {"status": "processing", "percent": 50}

event: result
data: {"status": "completed", "text": "识别结果", "time_cost": 1.2}

event: error
data: {"status": "failed", "message": "引擎异常"}
```

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 后端端口 | `8000` |
| `WORKER_COUNT` | 工作线程数 | `1` |
| `DB_PATH` | 数据库路径 | `%APPDATA%/screenshot-ocr-demo/db.sqlite3` |