[简体中文](README.md) | English

# Screenshot OCR Demo

An offline desktop screenshot OCR tool powered by Electron, FastAPI, and PaddleOCR.
Built as a technical demo to showcase local AI model integration and cross-language desktop architecture.

## ⬇️ Download

Get the latest release from **[Releases](https://github.com/QiJi3/screenshot-ocr-demo/releases)**:
- **Portable (.zip)**: Extract and run.
- **Installer (.exe)**: Standard Windows setup.

## ✨ Features

- **Instant UI**: Uses `loading.html` and Electron preloaders for millisecond window rendering, while the heavy OCR engine loads asynchronously in the background (4-6s).
- **Standalone Backend**: Compiled into `backend.exe` using PyInstaller, eliminating the need for a local Python environment.
- **Local Storage**: Images and SQLite DB are safely stored in the system's AppData folder.
- **Real-time SSE**: Utilizes Server-Sent Events to stream OCR progress and results.

## 🚀 Quick Start

### For Users
1. Download the latest Release.
2. Run the application and start taking screenshots for offline recognition.

### For Developers

**Prerequisites**
- Node.js (v18+)
- Python 3.10+
- pnpm

**1. Clone**
```bash
git clone https://github.com/QiJi3/screenshot-ocr-demo.git
cd screenshot-ocr-demo
```

**2. Frontend Setup**
```bash
pnpm install
```

**3. Backend Setup**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
cd ..
```

**4. Start Dev Server**
```bash
pnpm run dev
```

**5. Build**
```bash
pnpm run build
```
Build artifacts (standalone exe and zip) will be in the `dist/` directory.

## 📂 Project Structure

```text
screenshot-ocr-demo/
├── .github/                  # CI/CD Workflows
├── backend/                  # Python Backend
│   ├── main.py               # FastAPI Service
│   ├── ocr_engine.py         # PaddleOCR Wrapper
│   ├── backend.spec          # PyInstaller Config
│   └── dist_backend/         # (Generated) Standalone executable
├── src/                      # Electron Source
│   ├── main/                 # Main Process
│   ├── renderer/             # Renderer Process (UI)
│   └── loading.html          # Splash Screen
└── package.json
```

## 🔌 API Reference

Default local port `8000`:

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/ocr` | `POST` | Submit image for OCR |
| `/api/status` | `GET` | Check engine status |
| `/api/history` | `GET` | Get OCR history |

### SSE Format

```http
event: progress
data: {"status": "processing", "percent": 50}

event: result
data: {"status": "completed", "text": "Result text", "time_cost": 1.2}

event: error
data: {"status": "failed", "message": "Exception occurred"}
```

## ⚙️ Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Backend Port | `8000` |
| `WORKER_COUNT` | OCR Threads | `1` |
| `DB_PATH` | Database Path | `%APPDATA%/screenshot-ocr-demo/db.sqlite3` |