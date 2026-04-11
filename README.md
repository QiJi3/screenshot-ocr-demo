<div align="center">

# Screenshot OCR Demo

**基于 Electron + FastAPI + PaddleOCR 的离线桌面截图 OCR 工具**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)]()
[![Electron](https://img.shields.io/badge/Electron-Latest-47848F?logo=electron&logoColor=white)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-009688?logo=fastapi&logoColor=white)]()

[English](README_EN.md) | 简体中文

</div>

---

本项目为一个技术验证 Demo，旨在展示**本地端侧大模型集成**与**跨语言桌面应用架构**的设计。

## 📥 获取应用

请前往 **[Releases](https://github.com/QiJi3/screenshot-ocr-demo/releases)** 页面获取最新版本的构建产物：

- **便携版 (.zip)**: 绿色免安装，解压即用。
- **安装版 (.exe)**: 标准 Windows 安装向导。

## 💡 核心特性

- **异步加载与秒级响应**: 引入 `loading.html` 与 Electron 预加载机制，客户端界面实现毫秒级拉起，后台异步启动重量级 OCR 引擎（耗时约 4-6 秒）。
- **完全离线独立运行**: 后端采用 `PyInstaller` 编译为独立的 `backend.exe`，目标机器无需配置任何 Python 环境即可运行。
- **数据安全隔离**: 截图记录与 SQLite 数据库存储于系统 `AppData` 目录，避免权限冲突与工作区污染。
- **流式通信架构**: 前后端通过 Server-Sent Events (SSE) 建立单向长连接，实时推送 OCR 解析进度与结果。

## 🛠️ 本地开发指南

### 环境依赖

开发本项目前，请确保本地已安装以下环境：
- Node.js (建议 v18 及以上)
- Python (3.10 及以上)
- pnpm 包管理器

### 快速启动

**1. 克隆代码仓库**
```bash
git clone https://github.com/QiJi3/screenshot-ocr-demo.git
cd screenshot-ocr-demo
```

**2. 安装前端依赖**
```bash
pnpm install
```

**3. 配置后端环境**
```bash
cd backend
python -m venv .venv
# 激活虚拟环境 (Windows 环境)
.venv\Scripts\activate
# 安装 Python 依赖
pip install -r requirements.txt
cd ..
```

**4. 启动开发服务器**
```bash
pnpm run dev
```

**5. 生产环境构建**
```bash
pnpm run build
```
构建成功后，可执行文件及资源将输出至 `dist/` 目录。

## 🏗️ 项目结构

```text
screenshot-ocr-demo/
├── .github/                  # CI/CD 自动化构建工作流
├── backend/                  # Python 后端工程
│   ├── main.py               # FastAPI 服务入口
│   ├── ocr_engine.py         # PaddleOCR 核心封装
│   ├── backend.spec          # PyInstaller 编译配置
│   └── dist_backend/         # 独立可执行文件输出目录
├── src/                      # Electron 前端工程
│   ├── main/                 # 主进程 (窗口管理与后端子进程调度)
│   ├── renderer/             # 渲染进程 (Vue/React 视图层)
│   └── loading.html          # 极速启动屏
└── package.json
```

## 📡 API Reference

本地后端服务默认监听 `8000` 端口。

| 接口路由 | 请求方法 | 功能描述 |
| --- | --- | --- |
| `/api/ocr` | `POST` | 提交截图进行文本识别 |
| `/api/status` | `GET` | 检查后端引擎加载状态 |
| `/api/history` | `GET` | 查询历史 OCR 识别记录 |

### SSE 进度流数据格式

```http
event: progress
data: {"status": "processing", "percent": 50}

event: result
data: {"status": "completed", "text": "识别结果内容", "time_cost": 1.2}

event: error
data: {"status": "failed", "message": "引擎初始化异常"}
```

## ⚙️ 环境变量配置

系统支持通过环境变量自定义配置：

| 变量名称 | 描述 | 默认值 |
| --- | --- | --- |
| `PORT` | 后端服务监听端口 | `8000` |
| `WORKER_COUNT` | OCR 并发工作线程数 | `1` |
| `DB_PATH` | 数据库存储绝对路径 | `%APPDATA%/screenshot-ocr-demo/db.sqlite3` |