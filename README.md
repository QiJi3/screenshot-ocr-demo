[English](README_EN.md) | 简体中文

# Screenshot OCR Demo (截图 OCR 演示工具)

![preview](截图URL)

一个基于 Electron + Python FastAPI + PaddleOCR 构建的本地桌面截图 OCR 工具。本项目主要作为**求职展示与技术 Demo**，展示了跨语言桌面应用架构设计、本地大模型服务集成以及出色的客户端体验优化。

## ⬇️ 下载体验

前往 **[GitHub Releases](https://github.com/QiJi3/screenshot-ocr-demo/releases)** 下载最新版本：
- 📦 **免安装便携版 (.zip)**：解压即用，双击秒开。
- 💿 **安装向导版 (.exe)**：传统的 Windows 安装程序。

---

## ✨ 核心特性

- **极致启动体验**：引入 loading.html 启动页，客户端窗口**秒级响应**，后台无感启动重量级 OCR 引擎（约 4-6 秒）。
- **开箱即用**：后端通过 PyInstaller 编译为独立 ackend.exe，不依赖本地 Python 环境或 .venv。
- **数据安全隔离**：截图文件与 SQLite 数据库默认存储于系统的 userData (AppData) 目录，避免权限问题与目录污染。
- **SSE 流式通信**：前端与后端通过 Server-Sent Events (SSE) 实时推送 OCR 进度与识别结果。
- **现代化架构**：Electron (UI 壳) + FastAPI (核心计算) 的解耦设计。

## 🚀 快速开始

### 👤 普通用户体验
1. 前往 [Releases](https://github.com/QiJi3/screenshot-ocr-demo/releases) 下载 .zip 或安装包。
2. 运行 Screenshot OCR Demo.exe。
3. 截图并体验秒级离线 OCR 解析。

### 💻 开发者指南（本地开发）

#### 环境准备
- Node.js (推荐 v18+)
- Python 3.10+
- pnpm

#### 1. 克隆代码
`ash
git clone https://github.com/QiJi3/screenshot-ocr-demo.git
cd screenshot-ocr-demo
`

#### 2. 安装前端依赖
`ash
pnpm install
`

#### 3. 配置后端环境
`ash
cd backend
python -m venv .venv
# 激活虚拟环境 (Windows)
.venv\Scripts\activate
# 安装依赖
pip install -r requirements.txt
cd ..
`

#### 4. 启动开发环境
`ash
# 启动前端及后端服务
pnpm run dev
`

#### 5. 打包构建
`ash
# 构建后端可执行文件 (PyInstaller) 及前端资源
pnpm run build
`
构建产物将生成两种格式（便携 zip 及 nsis 安装包），位于 dist/ 目录下。

## 📂 项目结构

`	ext
screenshot-ocr-demo/
├── .github/                  # GitHub Actions CI/CD 工作流
├── backend/                  # Python 后端目录
│   ├── main.py               # FastAPI 核心服务
│   ├── ocr_engine.py         # PaddleOCR 引擎封装
│   ├── backend.spec          # PyInstaller 构建配置
│   ├── requirements.txt      # Python 依赖
│   └── dist_backend/         # (构建生成) 后端可执行文件目录
├── src/                      # Electron 源码目录
│   ├── main/                 # 主进程 (窗口管理、后端子进程调度)
│   ├── renderer/             # 渲染进程 (Vue/React UI层)
│   └── loading.html          # 秒开动画加载页
├── package.json
└── README.md
`

## 🔌 API Reference

后端基于 FastAPI 提供以下本地 RESTful API（默认端口 8000）：

| 接口 | 方法 | 描述 |
| --- | --- | --- |
| /api/ocr | POST | 提交图片进行 OCR 识别任务 |
| /api/status | GET | 检查后端服务就绪状态 |
| /api/history | GET | 获取历史 OCR 识别记录 |

### SSE (Server-Sent Events) 数据流格式
图片上传后，建立 SSE 连接以接收实时解析进度：

`http
event: progress
data: {"status": "processing", "percent": 50}

event: result
data: {"status": "completed", "text": "识别到的文本内容", "time_cost": 1.2}

event: error
data: {"status": "failed", "message": "引擎初始化失败"}
`

## ⚙️ 环境变量

系统支持通过环境变量进行自定义配置：

| 变量名 | 说明 | 默认值 |
| --- | --- | --- |
| PORT | 后端服务监听端口 | 8000 |
| WORKER_COUNT | OCR 引擎工作线程数 | 1 |
| DB_PATH | SQLite 数据库文件存储路径 | %APPDATA%/screenshot-ocr-demo/db.sqlite3 |