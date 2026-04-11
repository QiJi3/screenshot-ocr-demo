# 截图 OCR Demo

[English](README_EN.md)

本地运行的桌面截图 OCR 工具。Electron 每 10 秒自动截屏，FastAPI + RapidOCR 在本机识别文字，React 仪表盘通过 SSE 实时推送展示结果。

**Electron 截图** → **RapidOCR 识别** → **SSE 推送** → **React 仪表盘**

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 · Vite · Ant Design · TypeScript |
| 后端 | FastAPI · Uvicorn · SQLite · Python 3.x |
| 桌面端 | Electron 30（内置 desktopCapturer，无需外部截图依赖）|
| OCR 引擎 | RapidOCR ONNX（默认 PP-OCRv3，可选升级 PP-OCRv4）|

## 功能

- 每 10 秒自动截屏，本地 OCR 识别，结果存入 SQLite
- SSE 长连接实时推送——Electron 窗口和浏览器同时更新，无轮询
- 图像预处理（自动缩放 + 对比度增强 + 锐化），可在设置中关闭
- 支持可选 PP-OCRv4 模型（准确率更高，需手动下载放入 `backend/models/`）
- 设置面板：置信度阈值、行合并阈值、预处理开关（运行时热更新）
- 中文菜单栏，支持在浏览器中单独打开 Web UI（`http://127.0.0.1:8000`）
- 上传任意图片进行 OCR 识别（`POST /ocr/recognize`）

## 项目结构

```
screenshot-ocr-demo/
├── backend/
│   ├── main.py            # FastAPI 全部逻辑（单文件）
│   ├── models/            # 可选：放 PP-OCRv4 .onnx 模型
│   ├── screenshots/       # 运行时截图（自动创建）
│   ├── ocr_records.db     # SQLite 数据库（自动创建）
│   └── .venv/             # Python 虚拟环境
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── types.ts
│   │   └── components/    # MonitorCard / OcrResultCard / HistoryTable
│   └── dist/              # 构建产物（由 backend 托管）
└── electron/
    └── index.js           # 主进程（单文件）
```

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+（建议 20+）
- pnpm

### 安装

```bash
# 后端 Python 依赖
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install fastapi uvicorn rapidocr-onnxruntime sqlalchemy pillow numpy

# 前端
cd ../frontend
pnpm install

# Electron
cd ../electron
npm install
```

### 开发态启动

```bash
# 1. 构建前端（只需首次或改动后执行）
cd frontend && pnpm build

# 2. 启动 Electron（自动拉起 backend，等待 /health 后加载页面）
cd electron
NODE_OPTIONS= npm start
```

> `NODE_OPTIONS=` 是为了清除系统注入的 `--use-system-ca`，避免 Electron 报错。

### 单独启动 backend（调试用）

```bash
cd backend
.venv\Scripts\activate
python main.py
# 访问 http://127.0.0.1:8000
```

## 可选：升级 PP-OCRv4 模型

默认使用 PP-OCRv3，可下载 PP-OCRv4 模型获得更高中英文识别率：

1. 下载以下两个文件（ONNX 格式）：
   - `ch_PP-OCRv4_det_infer.onnx`（检测模型）
   - `ch_PP-OCRv4_rec_infer.onnx`（识别模型）
2. 放入 `backend/models/` 目录
3. 重启 backend，控制台输出 `[OCR] Using PP-OCRv4 models` 即生效

> 模型可从 PaddleOCR 官方仓库或 Hugging Face 获取 ONNX 转换版本。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/settings` | 获取当前 OCR 参数 |
| POST | `/settings` | 更新 OCR 参数（热更新，无需重启）|
| POST | `/captures/process` | 处理截图文件并入库（由 Electron 调用）|
| GET | `/captures` | 获取全部历史记录（降序）|
| GET | `/captures/latest` | 获取最新一条记录 |
| GET | `/captures/events` | SSE 长连接，有新记录时推送 `new_capture` 事件 |
| POST | `/ocr/recognize` | 上传图片直接识别，返回文字（不入库）|
| GET | `/screenshots/{name}` | 访问截图静态资源 |

### SSE 事件格式

```json
{
  "type": "new_capture",
  "record": {
    "id": 42,
    "timestamp": "2026-04-10T15:00:00",
    "text": "识别出的文字内容",
    "screenshot_url": "/screenshots/screenshot_1234567890.png"
  }
}
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SCREENSHOTS_DIR` | `backend/screenshots/` | 截图保存目录 |
| `FRONTEND_DIR` | 无 | 前端 dist 目录，设置后 backend 托管静态文件 |

## Legacy 说明

当前仓库已经作为新的 demo 主线使用。原来的 `screenshot-ocr-demo` 仓库应归类为 legacy，仅保留旧打包链路与历史实现参考。
