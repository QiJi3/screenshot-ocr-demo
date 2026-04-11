# Screenshot OCR Demo

[中文文档](README_CN.md)

A local desktop screenshot OCR tool. Electron captures the screen every 10 seconds, FastAPI + RapidOCR recognizes text on-device, and a React dashboard receives results via SSE in real time.

**Electron screenshot** → **RapidOCR recognition** → **SSE push** → **React dashboard**

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 · Vite · Ant Design · TypeScript |
| Backend | FastAPI · Uvicorn · SQLite · Python 3.x |
| Desktop | Electron 30 (built-in `desktopCapturer`, no external deps) |
| OCR Engine | RapidOCR ONNX (PP-OCRv3 default, PP-OCRv4 optional) |

## Features

- Auto-screenshot every 10 seconds with local OCR, results saved to SQLite
- SSE long-connection push — Electron window and browser stay in sync, no polling
- Image preprocessing (auto-scale + contrast boost + sharpen), toggleable in settings
- Optional PP-OCRv4 models for higher accuracy (place `.onnx` files in `backend/models/`)
- Settings panel: confidence threshold, line-merge threshold, preprocessing toggle, capture mode
- **Demo mode**: upload any image for instant OCR (does not save to DB)
- Chinese menu bar; open Web UI separately in browser (`http://127.0.0.1:8000`)
- IPC channel between Electron menu and renderer (settings / demo drawers)

## Project Structure

```
screenshot-ocr-demo/
├── backend/
│   ├── main.py            # All FastAPI logic (single file)
│   ├── requirements.txt
│   ├── models/            # Optional: PP-OCRv4 .onnx models
│   ├── screenshots/       # Runtime screenshots (auto-created)
│   ├── ocr_records.db     # SQLite database (auto-created)
│   └── .venv/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── types.ts
│   │   └── components/    # MonitorCard / OcrResultCard / HistoryTable
│   └── dist/              # Build output (served by backend)
├── electron/
│   └── index.js           # Main process (single file)
├── start.ps1              # One-click startup script
└── .gitignore
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+ (20+ recommended)
- pnpm

### Install

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
pnpm install

# Electron
cd ../electron
npm install
```

### Start (development)

```powershell
# One-click
.\start.ps1

# Or manually:
# 1. Build frontend (first time or after changes)
cd frontend; pnpm build

# 2. Launch Electron (auto-starts backend, waits for /health, then loads page)
cd electron; $env:NODE_OPTIONS=''; npm start
```

### Backend only (for debugging)

```bash
cd backend
.venv\Scripts\activate
python main.py
# Open http://127.0.0.1:8000
```

## Optional: PP-OCRv4 Models

Default uses PP-OCRv3. Download PP-OCRv4 ONNX models for better accuracy:

1. Get these two files (ONNX format):
   - `ch_PP-OCRv4_det_infer.onnx`
   - `ch_PP-OCRv4_rec_infer.onnx`
2. Place them in `backend/models/`
3. Restart backend — console shows `[OCR] Using PP-OCRv4 models`

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/settings` | Get current OCR parameters |
| POST | `/settings` | Update OCR parameters (hot-reload, no restart needed) |
| POST | `/captures/process` | Process screenshot file and save to DB (called by Electron) |
| GET | `/captures` | Get all records (descending) |
| GET | `/captures/latest` | Get latest record |
| GET | `/captures/events` | SSE stream — pushes `new_capture` event on each new record |
| POST | `/ocr/recognize` | Upload image for instant OCR (not saved to DB) |
| GET | `/screenshots/{name}` | Static screenshot access |

### SSE Event Format

```json
{
  "type": "new_capture",
  "record": {
    "id": 42,
    "timestamp": "2026-04-10T15:00:00",
    "text": "recognized text content",
    "screenshot_url": "/screenshots/screenshot_1234567890.png"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCREENSHOTS_DIR` | `backend/screenshots/` | Screenshot save directory |
| `FRONTEND_DIR` | — | Frontend `dist` path; set by Electron so backend serves static files |

## Legacy Note

This repository is now the new demo baseline. The former `screenshot-ocr-demo` repository should be treated as legacy reference for older packaging and release workflows.
