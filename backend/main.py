import os
import asyncio
import json
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from PIL import Image, ImageEnhance, ImageFilter
from rapidocr_onnxruntime import RapidOCR
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCREENSHOTS_DIR = os.environ.get("SCREENSHOTS_DIR", os.path.join(os.path.dirname(__file__), "screenshots"))
FRONTEND_DIR = os.environ.get("FRONTEND_DIR", None)
DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "ocr_records.db"))
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

app.mount("/screenshots", StaticFiles(directory=SCREENSHOTS_DIR), name="screenshots")

Base = declarative_base()

class OCRRecord(Base):
    __tablename__ = "ocr_records"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.now)
    text = Column(String)
    screenshot_url = Column(String)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
_det = os.path.join(MODELS_DIR, "ch_PP-OCRv4_det_infer.onnx")
_rec = os.path.join(MODELS_DIR, "ch_PP-OCRv4_rec_infer.onnx")
if os.path.exists(_det) and os.path.exists(_rec):
    ocr_engine = RapidOCR(det_model_path=_det, rec_model_path=_rec, det_limit_side_len=1280)
    print("[OCR] Using PP-OCRv4 models")
else:
    ocr_engine = RapidOCR(det_limit_side_len=1280)
    print("[OCR] Using default models (put v4 .onnx in backend/models/ for better accuracy)")

_ocr_lock = asyncio.Lock()
_subscribers: list[asyncio.Queue] = []

class OCRRequest(BaseModel):
    file_name: str

def _preprocess(filepath: str) -> np.ndarray:
    img = Image.open(filepath).convert('RGB')
    w, h = img.size
    if h < 1080:
        scale = 1080 / h
        img = img.resize((int(w * scale), 1080), Image.LANCZOS)
    img = ImageEnhance.Contrast(img).enhance(1.5)
    img = img.filter(ImageFilter.SHARPEN)
    return np.array(img)

def _run_ocr(filepath: str) -> tuple:
    src = _preprocess(filepath) if app_settings.enable_preprocess else filepath
    return ocr_engine(src)

class AppSettings(BaseModel):
    confidence: float = 0.5
    line_threshold: int = 15
    enable_preprocess: bool = True
    capture_mode: str = "screen"    # "screen" | "window"
    capture_scale: float = 1.0      # 0.5 | 1.0 | 1.5 | 2.0

app_settings = AppSettings()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/settings")
def get_settings():
    return app_settings

@app.post("/settings")
def update_settings(new_settings: AppSettings):
    global app_settings
    app_settings = new_settings
    return app_settings

@app.post("/captures/process")
async def process_ocr(request: OCRRequest):
    try:
        filepath = os.path.join(SCREENSHOTS_DIR, request.file_name)
        loop = asyncio.get_running_loop()
        async with _ocr_lock:
            result, _ = await loop.run_in_executor(None, _run_ocr, filepath)
        text = ""
        if result:
            filtered = [r for r in result if r[2] >= app_settings.confidence]
            filtered.sort(key=lambda r: (r[0][0][1], r[0][0][0]))
            lines, cur_line, cur_y = [], [], None
            for r in filtered:
                y = r[0][0][1]
                if cur_y is None or abs(y - cur_y) <= app_settings.line_threshold:
                    cur_line.append(r)
                    cur_y = y if cur_y is None else cur_y
                else:
                    if cur_line:
                        lines.append(cur_line)
                    cur_line, cur_y = [r], y
            if cur_line:
                lines.append(cur_line)
            text = "\n".join(" ".join(item[1] for item in line) for line in lines)

        db = SessionLocal()
        ts = datetime.datetime.now()
        record = OCRRecord(
            text=text,
            screenshot_url=f"/screenshots/{request.file_name}",
            timestamp=ts
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        record_id = record.id
        db.close()

        payload = json.dumps({
            "type": "new_capture",
            "record": {
                "id": record_id,
                "timestamp": ts.isoformat(),
                "text": text,
                "screenshot_url": f"/screenshots/{request.file_name}"
            }
        })
        for q in _subscribers[:]:
            q.put_nowait(payload)

        return {"status": "success", "text": text}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/captures")
def get_captures():
    db = SessionLocal()
    records = db.query(OCRRecord).order_by(OCRRecord.timestamp.desc()).all()
    db.close()
    return [{"id": r.id, "text": r.text, "screenshot_url": r.screenshot_url, "timestamp": r.timestamp} for r in records]

@app.get("/captures/latest")
def get_latest_capture():
    db = SessionLocal()
    record = db.query(OCRRecord).order_by(OCRRecord.timestamp.desc()).first()
    db.close()
    if record:
        return {"id": record.id, "text": record.text, "screenshot_url": record.screenshot_url, "timestamp": record.timestamp}
    return None

@app.post("/ocr/recognize")
async def recognize_upload(file: UploadFile = File(...)):
    import tempfile, shutil
    suffix = os.path.splitext(file.filename or "img.png")[1] or ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        loop = asyncio.get_running_loop()
        async with _ocr_lock:
            result, _ = await loop.run_in_executor(None, _run_ocr, tmp_path)
        text = ""
        if result:
            filtered = [r for r in result if r[2] >= app_settings.confidence]
            filtered.sort(key=lambda r: (r[0][0][1], r[0][0][0]))
            lines, cur_line, cur_y = [], [], None
            for r in filtered:
                y = r[0][0][1]
                if cur_y is None or abs(y - cur_y) <= app_settings.line_threshold:
                    cur_line.append(r)
                    cur_y = y if cur_y is None else cur_y
                else:
                    if cur_line:
                        lines.append(cur_line)
                    cur_line, cur_y = [r], y
            if cur_line:
                lines.append(cur_line)
            text = "\n".join(" ".join(item[1] for item in line) for line in lines)
        return {"text": text}
    finally:
        os.unlink(tmp_path)

@app.get("/captures/events")
async def sse_events():
    q: asyncio.Queue = asyncio.Queue(maxsize=20)
    _subscribers.append(q)

    async def stream():
        try:
            yield 'data: {"type":"connected"}\n\n'
            while True:
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=25)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            try:
                _subscribers.remove(q)
            except ValueError:
                pass

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

if FRONTEND_DIR and os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)