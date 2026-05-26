import importlib
import io
import sys
import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture
def main_module(tmp_path, monkeypatch):
    config_path = tmp_path / "test_config.json"
    db_path = tmp_path / "test_records.db"
    screenshots_dir = tmp_path / "screenshots"
    screenshots_dir.mkdir()

    monkeypatch.setenv("OCR_CONFIG_PATH", str(config_path))
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("SCREENSHOTS_DIR", str(screenshots_dir))
    monkeypatch.delenv("FRONTEND_DIR", raising=False)

    sys.modules.pop("main", None)
    module = importlib.import_module("main")
    module._original_get_ocr_engine = module.get_ocr_engine

    async def fake_get_ocr_engine():
        return object()

    monkeypatch.setattr(module, "get_ocr_engine", fake_get_ocr_engine)

    yield module

    module.engine.dispose()
    sys.modules.pop("main", None)


@pytest.fixture
def client(main_module):
    with TestClient(main_module.app) as test_client:
        yield test_client


class TestSettingsAPI:
    """Settings API 的集成测试"""

    def test_get_ocr_config(self, client):
        """测试获取 OCR 配置"""
        health_response = client.get("/health")
        assert health_response.status_code == 200
        assert health_response.json()["status"] == "ok"

        settings_response = client.get("/settings")
        assert settings_response.status_code == 200
        assert settings_response.json()["capture_mode"] == "screen"

        response = client.get("/api/settings/ocr-config")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "model_version" in data
        assert "custom_det_path" in data
        assert "custom_rec_path" in data
        assert "available_versions" in data
        assert data["model_version"] in ["v3", "v4", "custom"]

    def test_update_ocr_config(self, client, main_module, monkeypatch):
        """测试更新 OCR 配置"""
        settings_payload = {
            "confidence": 0.65,
            "line_threshold": 18,
            "enable_preprocess": False,
            "capture_mode": "window",
            "capture_scale": 1.5,
        }
        settings_response = client.post("/settings", json=settings_payload)
        assert settings_response.status_code == 200
        assert settings_response.json()["capture_mode"] == "window"

        response = client.post(
            "/api/settings/ocr-config",
            json={"model_version": "v3"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["model_version"] == "v3"

        response = client.get("/api/settings/ocr-config")
        assert response.json()["model_version"] == "v3"

        calls = []

        class DummyRapidOCR:
            def __init__(self, **kwargs):
                calls.append(kwargs)
                if kwargs.get("det_model_path") == "broken-det.onnx":
                    raise RuntimeError("load failed")

        monkeypatch.setattr(main_module, "RapidOCR", DummyRapidOCR)

        monkeypatch.setattr(main_module.ocr_config, "get_model_paths", lambda: ("det.onnx", "rec.onnx"))
        main_module._ocr_engine = None
        engine = asyncio.run(main_module._original_get_ocr_engine())
        assert isinstance(engine, DummyRapidOCR)
        assert calls[-1]["det_model_path"] == "det.onnx"

        monkeypatch.setattr(main_module.ocr_config, "get_model_paths", lambda: (None, None))
        main_module._ocr_engine = None
        fallback_engine = asyncio.run(main_module._original_get_ocr_engine())
        assert isinstance(fallback_engine, DummyRapidOCR)
        assert calls[-1] == {"det_limit_side_len": 1280}

        monkeypatch.setattr(main_module.ocr_config, "get_model_paths", lambda: ("broken-det.onnx", "broken-rec.onnx"))
        main_module._ocr_engine = None
        error_engine = asyncio.run(main_module._original_get_ocr_engine())
        assert isinstance(error_engine, DummyRapidOCR)
        assert calls[-1] == {"det_limit_side_len": 1280}

    def test_update_custom_model(self, client, main_module, tmp_path):
        """测试更新为自定义模型"""
        response = client.post(
            "/api/settings/ocr-config",
            json={
                "model_version": "custom",
                "custom_det_path": "/path/det.onnx",
                "custom_rec_path": "/path/rec.onnx",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"

        response = client.get("/api/settings/ocr-config")
        data = response.json()
        assert data["model_version"] == "custom"
        assert data["custom_det_path"] == "/path/det.onnx"
        assert data["custom_rec_path"] == "/path/rec.onnx"

        image_path = tmp_path / "sample.png"
        Image.new("RGB", (120, 60), color="white").save(image_path)
        array = main_module._preprocess(str(image_path))
        assert array.shape[0] == 1080

        class DummyEngine:
            def __init__(self):
                self.last_input = None

            def __call__(self, value):
                self.last_input = value
                return ("ok", None)

        main_module.app_settings.enable_preprocess = True
        preprocess_engine = DummyEngine()
        main_module._run_ocr(str(image_path), preprocess_engine)
        assert getattr(preprocess_engine.last_input, "shape", None) is not None

        main_module.app_settings.enable_preprocess = False
        passthrough_engine = DummyEngine()
        main_module._run_ocr(str(image_path), passthrough_engine)
        assert passthrough_engine.last_input == str(image_path)

    def test_invalid_model_version(self, client):
        """测试无效的模型版本"""
        response = client.post(
            "/api/settings/ocr-config",
            json={"model_version": "invalid"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "error"

    def test_list_available_models(self, client, main_module, monkeypatch):
        """测试列出可用模型"""
        response = client.get("/api/settings/available-models")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "available_models" in data
        models = data["available_models"]
        assert len(models) > 0

        model_names = [model["name"] for model in models]
        assert "v3" in model_names
        assert "v4" in model_names

        screenshot_path = Path(main_module.SCREENSHOTS_DIR) / "test-shot.png"
        screenshot_path.write_bytes(b"fake-image")

        def fake_run_ocr(filepath, engine):
            assert filepath == str(screenshot_path)
            return (
                [
                    ([[0, 0], [10, 0], [10, 10], [0, 10]], "hello", 0.96),
                    ([[20, 20], [30, 20], [30, 30], [20, 30]], "world", 0.97),
                ],
                None,
            )

        monkeypatch.setattr(main_module, "_run_ocr", fake_run_ocr)
        process_response = client.post("/captures/process", json={"file_name": "test-shot.png"})
        assert process_response.status_code == 200
        assert process_response.json()["status"] == "success"
        assert "hello" in process_response.json()["text"]

        captures_response = client.get("/captures")
        assert captures_response.status_code == 200
        captures = captures_response.json()
        assert len(captures) == 1
        assert "hello" in captures[0]["text"]

        latest_response = client.get("/captures/latest")
        assert latest_response.status_code == 200
        assert "world" in latest_response.json()["text"]

    def test_api_response_format(self, client, main_module, monkeypatch):
        """测试 API 响应格式"""
        response = client.get("/api/settings/ocr-config")
        data = response.json()

        required_fields = ["status", "model_version", "available_versions"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

        def fake_run_ocr(filepath, engine):
            return (
                [
                    ([[0, 0], [10, 0], [10, 10], [0, 10]], "upload-text", 0.99),
                ],
                None,
            )

        monkeypatch.setattr(main_module, "_run_ocr", fake_run_ocr)

        image_bytes = io.BytesIO()
        Image.new("RGB", (200, 100), color="white").save(image_bytes, format="PNG")
        image_bytes.seek(0)
        upload_response = client.post(
            "/ocr/recognize",
            files={"file": ("sample.png", image_bytes.getvalue(), "image/png")},
        )
        assert upload_response.status_code == 200
        assert upload_response.json()["text"] == "upload-text"

    def test_concurrent_requests(self, client, main_module):
        """测试并发请求处理"""
        response = asyncio.run(main_module.sse_events())
        assert response.media_type == "text/event-stream"
        assert response.headers["Cache-Control"] == "no-cache"
        first_chunk = asyncio.run(response.body_iterator.__anext__())
        assert "connected" in first_chunk
        asyncio.run(response.body_iterator.aclose())

        for _ in range(5):
            response = client.get("/api/settings/ocr-config")
            assert response.status_code == 200
            assert response.json()["status"] == "success"
