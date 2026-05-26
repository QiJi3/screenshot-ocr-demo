# ocr_config.py - OCR 模型配置管理
from enum import Enum
from pathlib import Path
import json
import os


class ModelVersion(str, Enum):
    V3 = "v3"
    V4 = "v4"
    CUSTOM = "custom"


class OCRConfig:
    """OCR 模型配置管理类"""

    def __init__(self, config_path: str = None):
        if config_path is None:
            # 默认配置文件位置：AppData\screenshot-ocr-demo\config.json
            appdata = os.environ.get("APPDATA", ".")
            config_path = os.path.join(appdata, "screenshot-ocr-demo", "config.json")

        self.config_path = Path(config_path)
        self.model_version = "v4"  # 默认值
        self.custom_det_path = ""
        self.custom_rec_path = ""
        self.load()

    def load(self):
        """从配置文件加载设置"""
        try:
            if self.config_path.exists():
                with open(self.config_path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    self.model_version = config.get("model_version", "v4")
                    self.custom_det_path = config.get("custom_det_path", "")
                    self.custom_rec_path = config.get("custom_rec_path", "")
                    print(f"[OCR Config] Loaded from {self.config_path}")
            else:
                print("[OCR Config] Config file not found, using defaults")
                self.save()  # 创建默认配置文件
        except Exception as e:
            print(f"[OCR Config] Error loading config: {e}, using defaults")

    def save(self):
        """保存配置到文件"""
        try:
            config = {
                "model_version": self.model_version,
                "custom_det_path": self.custom_det_path,
                "custom_rec_path": self.custom_rec_path,
            }
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            print(f"[OCR Config] Saved to {self.config_path}")
        except Exception as e:
            print(f"[OCR Config] Error saving config: {e}")

    def get_model_paths(self) -> tuple:
        """获取当前选择的模型文件路径

        Returns:
            (det_model_path, rec_model_path) 元组
            如果模型文件不存在，返回 (None, None)
        """
        models_dir = Path(__file__).parent / "models"

        if self.model_version == ModelVersion.CUSTOM:
            # 自定义模型路径
            if self.custom_det_path and self.custom_rec_path:
                return (self.custom_det_path, self.custom_rec_path)
            else:
                print("[OCR Config] Custom paths not set, returning None")
                return (None, None)

        elif self.model_version == ModelVersion.V4:
            # PP-OCRv4 模型
            det_path = models_dir / "ch_PP-OCRv4_det_infer.onnx"
            rec_path = models_dir / "ch_PP-OCRv4_rec_infer.onnx"
            if det_path.exists() and rec_path.exists():
                return (str(det_path), str(rec_path))
            else:
                print(f"[OCR Config] v4 models not found at {models_dir}")
                return (None, None)

        elif self.model_version == ModelVersion.V3:
            # PP-OCRv3 模型
            det_path = models_dir / "ch_PP-OCRv3_det_infer.onnx"
            rec_path = models_dir / "ch_PP-OCRv3_rec_infer.onnx"
            if det_path.exists() and rec_path.exists():
                return (str(det_path), str(rec_path))
            else:
                print(f"[OCR Config] v3 models not found at {models_dir}")
                return (None, None)

        return (None, None)
