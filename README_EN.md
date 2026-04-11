[简体中文](README.md) | English

# Screenshot OCR Demo

![preview](截图URL)

A local desktop screenshot OCR tool built with Electron, Python FastAPI, and PaddleOCR. This project serves primarily as a **portfolio showcase and technical demo**, demonstrating cross-language desktop application architecture, local AI model integration, and excellent client-side user experience optimization.

## ⬇️ Download & Try

Visit **[GitHub Releases](https://github.com/QiJi3/screenshot-ocr-demo/releases)** to download the latest version:
- 📦 **Portable Version (.zip)**: Unzip and run. Instant startup.
- 💿 **Installer Version (.exe)**: Standard Windows setup wizard.

---

## ✨ Key Features

- **Instant Startup Experience**: Introduced a loading.html splash screen. The client window responds **instantly**, while the heavy OCR engine starts silently in the background (approx. 4-6 seconds).
- **Out of the Box**: The backend is compiled into a standalone ackend.exe via PyInstaller. No local Python environment or .venv is required.
- **Data Isolation**: Screenshots and the SQLite database are stored in the system's userData (AppData) directory by default, preventing permission issues and directory pollution.
- **SSE Streaming**: Real-time OCR progress and results are pushed from the backend to the frontend via Server-Sent Events (SSE).
- **Modern Architecture**: Decoupled design with Electron (UI shell) and FastAPI (Core computation).

## 🚀 Quick Start

### 👤 For Users
1. Go to [Releases](https://github.com/QiJi3/screenshot-ocr-demo/releases) and download the .zip or installer package.
2. Run Screenshot OCR Demo.exe.
3. Take a screenshot and experience blazing-fast offline OCR parsing.

### 💻 For Developers (Local Dev)

#### Prerequisites
- Node.js (v18+ recommended)
- Python 3.10+
- pnpm

#### 1. Clone the Repository
`ash
git clone https://github.com/QiJi3/screenshot-ocr-demo.git
cd screenshot-ocr-demo
`

#### 2. Install Frontend Dependencies
`ash
pnpm install
`

#### 3. Setup Backend Environment
`ash
cd backend
python -m venv .venv
# Activate virtual environment (Windows)
.venv\Scripts\activate
# Install dependencies
pip install -r requirements.txt
cd ..
`

#### 4. Start Development Server
`ash
# Starts both frontend and backend services
pnpm run dev
`

#### 5. Build and Package
`ash
# Compiles backend executable (PyInstaller) and builds frontend assets
pnpm run build
`
The build artifacts will be generated in two formats (portable zip and nsis installer) located in the dist/ directory.

## 📂 Project Structure

`	ext
screenshot-ocr-demo/
├── .github/                  # GitHub Actions CI/CD workflows
├── backend/                  # Python backend directory
│   ├── main.py               # FastAPI core service
│   ├── ocr_engine.py         # PaddleOCR engine wrapper
│   ├── backend.spec          # PyInstaller build configuration
│   ├── requirements.txt      # Python dependencies
│   └── dist_backend/         # (Generated) Standalone backend executables
├── src/                      # Electron source directory
│   ├── main/                 # Main process (Window management, backend child process scheduling)
│   ├── renderer/             # Renderer process (Vue/React UI layer)
│   └── loading.html          # Instant startup splash screen
├── package.json
└── README.md
`

## 🔌 API Reference

The backend provides the following local RESTful APIs via FastAPI (default port 8000):

| Endpoint | Method | Description |
| --- | --- | --- |
| /api/ocr | POST | Submit an image for OCR processing |
| /api/status | GET | Check backend service readiness status |
| /api/history | GET | Fetch historical OCR records |

### SSE (Server-Sent Events) Format
After uploading an image, an SSE connection is established to receive real-time parsing progress:

`http
event: progress
data: {"status": "processing", "percent": 50}

event: result
data: {"status": "completed", "text": "Recognized text content", "time_cost": 1.2}

event: error
data: {"status": "failed", "message": "Engine initialization failed"}
`

## ⚙️ Environment Variables

The system supports custom configuration via environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| PORT | Backend service listening port | 8000 |
| WORKER_COUNT | Number of OCR engine worker threads | 1 |
| DB_PATH | Path to store the SQLite database file | %APPDATA%/screenshot-ocr-demo/db.sqlite3 |