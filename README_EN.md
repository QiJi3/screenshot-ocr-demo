# Screenshot OCR Demo

<p align="center">
  <img src="docs/images/banner.png" alt="Screenshot OCR Demo Banner" width="800" />
</p>

An offline desktop screenshot OCR tool powered by Electron, FastAPI, and RapidOCR, supporting PP-OCRv3, PP-OCRv4, and custom ONNX models.

English | [简体中文](README.md)

## 🎯 Features

### New in v1.1.0
- ✨ **OCR Model Selection Panel** - Quickly switch between PP-OCRv3 and PP-OCRv4 in the settings menu.
- 🎨 **Gear Icon Settings UI** - Open OCR configurations from the top-right gear icon.
- 🔄 **Dynamic Model Loading** - Switch OCR models on-the-fly without restarting the application.
- 📁 **Custom Model Support** - Load your own ONNX format model files.
- 💾 **Configuration Persistence** - Automatically persist user preferences to `AppData`.

### Core Features
- 🖼️ Quick screenshot capture and OCR text extraction.
- 📋 Automatic clipboard copy of recognized text.
- 🌐 Multi-language support (Chinese, English, etc.).
- ⚡ High-performance local inference engine.

### Tech Stack
- **Backend**: Python FastAPI + RapidOCR (PP-OCRv3/v4)
- **Frontend**: React 19.2.4 + Ant Design 6.3.5
- **Desktop Wrapper**: Electron
- **Testing**: pytest (15 tests, 93% coverage)

## 🚀 Quick Start

### Installation
1. Download the latest version from [Releases](https://github.com/QiJi11/screenshot-ocr-demo/releases)
2. Windows: Double-click the `.exe` installer.
3. Once completed, the application will automatically launch.

### Usage
1. Press the shortcut or click the system tray icon to trigger screenshot mode.
2. Select the area you want to recognize.
3. The OCR text will be copied to your clipboard instantly.
4. Click the `⚙` icon in the top-right corner to adjust settings or change the OCR model.

### Model Choices
- **PP-OCRv3**: Fast inference speed, ideal for real-time capture.
- **PP-OCRv4**: Higher accuracy, ideal for dense or small text.
- **Custom Model**: Use your own local `.onnx` model files.

## 🛠️ Local Development

### Frontend Development
```powershell
Set-Location D:\AtoC\Projects\screenshot-ocr-demo\frontend
npm install
npm run dev
```

### Backend Development
```powershell
Set-Location D:\AtoC\Projects\screenshot-ocr-demo\backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe main.py
```

### Package & Build
```powershell
Set-Location D:\AtoC\Projects\screenshot-ocr-demo\frontend
npm run build

Set-Location D:\AtoC\Projects\screenshot-ocr-demo\electron
npx electron-builder
```
The installer and zip files will be generated under the `electron/dist/` directory.

## 📡 API Reference

The local backend service runs on `127.0.0.1:8000` by default.

- `GET /health`: Health check endpoint.
- `POST /ocr/recognize`: Perform OCR text recognition.
- `POST /captures/process`: Process screenshot capture.
- `GET /api/settings/ocr-config`: Retrieve current OCR settings.
- `POST /api/settings/ocr-config`: Update OCR settings.
- `GET /api/settings/available-models`: List all available models.

## 📝 Version History

| Version | Release Date | Key Features |
|---|---|---|
| 1.1.0 | 2026-04-23 | Model selection panel, settings menu, config persistence |
| 1.0.0 | 2026-03-31 | Initial release, basic OCR features |