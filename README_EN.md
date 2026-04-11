<div align="center">

# Screenshot OCR Demo

**An offline desktop screenshot OCR tool powered by Electron, FastAPI, and PaddleOCR**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)]()
[![Electron](https://img.shields.io/badge/Electron-Latest-47848F?logo=electron&logoColor=white)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-009688?logo=fastapi&logoColor=white)]()

[简体中文](README.md) | English

</div>

---

This project serves as a technical demonstration showcasing the integration of **local AI models** and the architecture of **cross-language desktop applications**.

## 📥 Downloads

Get the latest build artifacts from the **[Releases](https://github.com/QiJi3/screenshot-ocr-demo/releases)** page:

- **Portable (.zip)**: Extract and run immediately without installation.
- **Installer (.exe)**: Standard Windows setup wizard.

## 💡 Key Features

- **Asynchronous Loading & Instant UI**: Utilizes `loading.html` and Electron preloading to render the window in milliseconds, while the OCR engine loads asynchronously in the background (4-6s).
- **Standalone Execution**: The backend is compiled into an independent `backend.exe` using `PyInstaller`, requiring no Python environment on the host machine.
- **Data Isolation**: Images and the SQLite database are safely stored in the system's `AppData` directory to avoid permission issues and workspace pollution.
- **Streaming Architecture**: Implements Server-Sent Events (SSE) for real-time streaming of OCR progress and recognition results.

## 🛠️ Local Development

### Prerequisites

Ensure the following environments are installed before starting:
- Node.js (v18 or higher recommended)
- Python (3.10 or higher)
- pnpm

### Quick Start

**1. Clone the repository**
```bash
git clone https://github.com/QiJi3/screenshot-ocr-demo.git
cd screenshot-ocr-demo
```

**2. Install frontend dependencies**
```bash
pnpm install
```

**3. Configure backend environment**
```bash
cd backend
python -m venv .venv
# Activate virtual environment (Windows)
.venv\Scripts\activate
# Install Python dependencies
pip install -r requirements.txt
cd ..
```

**4. Start the development server**
```bash
pnpm run dev
```

**5. Production build**
```bash
pnpm run build
```
The executable and assets will be output to the `dist/` directory.

## 🏗️ Project Structure

```text
screenshot-ocr-demo/
├── .github/                  # CI/CD Workflows
├── backend/                  # Python Backend
│   ├── main.py               # FastAPI Service
│   ├── ocr_engine.py         # PaddleOCR Wrapper
│   ├── backend.spec          # PyInstaller Config
│   └── dist_backend/         # Standalone executable output
├── src/                      # Electron Frontend
│   ├── main/                 # Main Process
│   ├── renderer/             # Renderer Process (UI layer)
│   └── loading.html          # Instant Startup Splash Screen
└── package.json
```

## 📡 API Reference

The local backend service listens on port `8000` by default.

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/ocr` | `POST` | Submit an image for text recognition |
| `/api/status` | `GET` | Check the engine loading status |
| `/api/history` | `GET` | Query OCR history records |

### SSE Progress Data Format

```http
event: progress
data: {"status": "processing", "percent": 50}

event: result
data: {"status": "completed", "text": "Recognized text content", "time_cost": 1.2}

event: error
data: {"status": "failed", "message": "Engine initialization error"}
```

## ⚙️ Environment Variables

The system supports custom configuration via environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Backend Port | `8000` |
| `WORKER_COUNT` | OCR Threads | `1` |
| `DB_PATH` | Database Path | `%APPDATA%/screenshot-ocr-demo/db.sqlite3` |