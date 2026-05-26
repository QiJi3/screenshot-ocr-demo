import os
import httpx
import asyncio
import json
from pathlib import Path
import numpy as np
from fastapi import FastAPI, UploadFile, File, APIRouter
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
from ocr_config import OCRConfig

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

CONFIG_PATH = os.environ.get(
    "OCR_CONFIG_PATH",
    os.path.join(os.environ.get("APPDATA", "."), "screenshot-ocr-demo", "config.json"),
)
ocr_config = OCRConfig(CONFIG_PATH)

_ocr_engine = None
_ocr_engine_lock = asyncio.Lock()
_ocr_lock = asyncio.Lock()
_subscribers: list[asyncio.Queue] = []


async def get_ocr_engine():
    """获取 OCR 引擎实例，支持动态切换模型"""
    global _ocr_engine

    async with _ocr_engine_lock:
        det_path, rec_path = ocr_config.get_model_paths()

        # 如果配置的模型文件不存在，降级到默认模型
        if det_path is None or rec_path is None:
            print("[OCR Engine] Model files not found, using RapidOCR default models")
            _ocr_engine = RapidOCR(det_limit_side_len=1280)
        else:
            try:
                _ocr_engine = RapidOCR(
                    det_model_path=det_path,
                    rec_model_path=rec_path,
                    det_limit_side_len=1280,
                )
                print(f"[OCR Engine] Loaded {ocr_config.model_version} model: {det_path}")
            except Exception as e:
                print(f"[OCR Engine] Failed to load model: {e}, using default")
                _ocr_engine = RapidOCR(det_limit_side_len=1280)

        return _ocr_engine

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

def _run_ocr(filepath: str, ocr_engine: RapidOCR) -> tuple:
    src = _preprocess(filepath) if app_settings.enable_preprocess else filepath
    return ocr_engine(src)

class AppSettings(BaseModel):
    confidence: float = 0.5
    line_threshold: int = 15
    enable_preprocess: bool = True
    capture_mode: str = "screen"    # "screen" | "window"
    capture_scale: float = 1.0      # 0.5 | 1.0 | 1.5 | 2.0

app_settings = AppSettings()
settings_router = APIRouter(prefix="/api/settings", tags=["settings"])

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


@settings_router.get("/llm-config")
async def get_llm_config():
    """获取当前 LLM 配置"""
    try:
        return {
            "status": "success",
            "llm_api_key": ocr_config.llm_api_key,
            "llm_base_url": ocr_config.llm_base_url,
            "llm_model": ocr_config.llm_model,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@settings_router.post("/llm-config")
async def update_llm_config(request_body: dict):
    """更新 LLM 配置"""
    try:
        ocr_config.llm_api_key = request_body.get("llm_api_key", "")
        ocr_config.llm_base_url = request_body.get("llm_base_url", "https://api.deepseek.com/v1")
        ocr_config.llm_model = request_body.get("llm_model", "deepseek-chat")
        ocr_config.save()
        return {
            "status": "success",
            "message": "LLM configuration updated successfully",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@settings_router.get("/ocr-config")
async def get_ocr_config():
    """获取当前 OCR 配置"""
    try:
        det_path, rec_path = ocr_config.get_model_paths()
        return {
            "status": "success",
            "model_version": ocr_config.model_version,
            "custom_det_path": ocr_config.custom_det_path,
            "custom_rec_path": ocr_config.custom_rec_path,
            "available_versions": ["v3", "v4", "custom"],
            "model_status": "ready" if (det_path and rec_path) else "not_ready",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@settings_router.post("/ocr-config")
async def update_ocr_config(request_body: dict):
    """更新 OCR 配置"""
    try:
        model_version = request_body.get("model_version", "v4")

        if model_version not in ["v3", "v4", "custom"]:
            return {"status": "error", "message": f"Invalid model_version: {model_version}"}

        ocr_config.model_version = model_version

        if model_version == "custom":
            ocr_config.custom_det_path = request_body.get("custom_det_path", "")
            ocr_config.custom_rec_path = request_body.get("custom_rec_path", "")

        ocr_config.save()
        await get_ocr_engine()

        return {
            "status": "success",
            "message": "Configuration updated successfully",
            "model_version": ocr_config.model_version,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@settings_router.get("/available-models")
async def list_available_models():
    """列出所有可用的 OCR 模型"""
    models_dir = Path(__file__).parent / "models"
    available = []

    v3_det = models_dir / "ch_PP-OCRv3_det_infer.onnx"
    v3_rec = models_dir / "ch_PP-OCRv3_rec_infer.onnx"
    available.append(
        {
            "name": "v3",
            "description": "PP-OCRv3 (Fast, lower accuracy)",
            "available": v3_det.exists() and v3_rec.exists(),
        }
    )

    v4_det = models_dir / "ch_PP-OCRv4_det_infer.onnx"
    v4_rec = models_dir / "ch_PP-OCRv4_rec_infer.onnx"
    available.append(
        {
            "name": "v4",
            "description": "PP-OCRv4 (Slower, higher accuracy)",
            "available": v4_det.exists() and v4_rec.exists(),
        }
    )

    return {"status": "success", "available_models": available}

@app.post("/api/ai/process")
async def process_with_ai(body: dict):
    text = body.get("text", "")
    task_type = body.get("task_type", "code_explain")
    
    api_key = os.environ.get("LLM_API_KEY") or ocr_config.llm_api_key
    base_url = os.environ.get("LLM_BASE_URL") or ocr_config.llm_base_url
    model = os.environ.get("LLM_MODEL") or ocr_config.llm_model
    
    if not api_key:
        async def err_gen():
            yield f"data: {json.dumps({'error': 'LLM API Key is not configured. Please set it in Settings.'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err_gen(), media_type="text/event-stream")
        
    prompts = {
        "code_explain": "You are an expert developer. Analyze the following OCR recognized text from a code screenshot. Explain any errors or logic, and provide the corrected code with brief explanations in Chinese:\n\n",
        "translate": "You are a professional translator. Translate the following text into natural and fluent Chinese (or English if the input is Chinese). Only provide the translated text without extra explanation:\n\n",
        "table_markdown": "Format the following tabular text into a clean Markdown table. Only output the markdown table code block:\n\n",
        "summarize": "Summarize the following text into a few key points in Chinese:\n\n"
    }
    
    prompt_prefix = prompts.get(task_type, "Please process the following text:\n\n")
    full_prompt = f"{prompt_prefix}{text}"
    
    async def stream_generator():
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": full_prompt}],
            "stream": True
        }
        
        async with httpx.AsyncClient() as client:
            try:
                clean_url = f"{base_url.rstrip('/')}/chat/completions"
                async with client.stream(
                    "POST",
                    clean_url,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                ) as response:
                    if response.status_code != 200:
                        error_detail = await response.aread()
                        err_text = error_detail.decode(errors='ignore')
                        err_msg = f"LLM API error (Status {response.status_code}): {err_text}"
                        yield f"data: {json.dumps({'error': err_msg})}\n\n"
                        yield "data: [DONE]\n\n"
                        return
                        
                    async for line in response.iter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                yield "data: [DONE]\n\n"
                                break
                            try:
                                data_json = json.loads(data_str)
                                content = data_json["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield f"data: {json.dumps({'content': content})}\n\n"
                            except Exception:
                                pass
            except Exception as e:
                yield f"data: {json.dumps({'error': f'Connection failed: {str(e)}'})}\n\n"
                yield "data: [DONE]\n\n"
                
    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/captures/process")
async def process_ocr(request: OCRRequest):
    try:
        filepath = os.path.join(SCREENSHOTS_DIR, request.file_name)
        engine = await get_ocr_engine()
        loop = asyncio.get_running_loop()
        async with _ocr_lock:
            result, _ = await loop.run_in_executor(None, _run_ocr, filepath, engine)
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
        engine = await get_ocr_engine()
        loop = asyncio.get_running_loop()
        async with _ocr_lock:
            result, _ = await loop.run_in_executor(None, _run_ocr, tmp_path, engine)
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

app.include_router(settings_router)

if FRONTEND_DIR and os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
