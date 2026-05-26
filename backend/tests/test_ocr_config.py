import json

import pytest

from ocr_config import OCRConfig, ModelVersion


@pytest.fixture
def temp_config_path(tmp_path):
    return str(tmp_path / "test_config.json")


class TestOCRConfig:
    """OCR 配置类的单元测试"""

    def test_init_default_config(self, temp_config_path):
        """测试初始化默认配置"""
        config = OCRConfig(temp_config_path)
        assert config.model_version == ModelVersion.V4.value
        assert config.custom_det_path == ""
        assert config.custom_rec_path == ""

    def test_save_and_load(self, temp_config_path):
        """测试配置保存和加载"""
        config1 = OCRConfig(temp_config_path)
        config1.model_version = ModelVersion.V3.value
        config1.save()

        config2 = OCRConfig(temp_config_path)
        assert config2.model_version == ModelVersion.V3.value

    def test_custom_model_paths(self, temp_config_path):
        """测试自定义模型路径"""
        config = OCRConfig(temp_config_path)
        config.model_version = ModelVersion.CUSTOM.value
        config.custom_det_path = "/path/to/det.onnx"
        config.custom_rec_path = "/path/to/rec.onnx"
        config.save()

        config2 = OCRConfig(temp_config_path)
        assert config2.model_version == ModelVersion.CUSTOM.value
        assert config2.custom_det_path == "/path/to/det.onnx"
        assert config2.custom_rec_path == "/path/to/rec.onnx"

        det, rec = config2.get_model_paths()
        assert det == "/path/to/det.onnx"
        assert rec == "/path/to/rec.onnx"

    def test_get_model_paths_v4(self, temp_config_path):
        """测试获取 v4 模型路径"""
        config = OCRConfig(temp_config_path)
        config.model_version = ModelVersion.V4.value
        det, rec = config.get_model_paths()

        if det and rec:
            assert "PP-OCRv4" in det
            assert "PP-OCRv4" in rec
        else:
            assert det is None
            assert rec is None

    def test_get_model_paths_v3(self, temp_config_path):
        """测试获取 v3 模型路径"""
        config = OCRConfig(temp_config_path)
        config.model_version = ModelVersion.V3.value
        det, rec = config.get_model_paths()

        if det and rec:
            assert "PP-OCRv3" in det
            assert "PP-OCRv3" in rec
        else:
            assert det is None
            assert rec is None

    def test_invalid_model_version(self, temp_config_path):
        """测试无效的模型版本"""
        config = OCRConfig(temp_config_path)
        config.model_version = "invalid"
        det, rec = config.get_model_paths()
        assert det is None
        assert rec is None

    def test_config_file_persistence(self, temp_config_path):
        """测试配置文件持久化"""
        config1 = OCRConfig(temp_config_path)
        config1.model_version = ModelVersion.V3.value
        config1.custom_det_path = "/custom/det.onnx"
        config1.save()

        with open(temp_config_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert data["model_version"] == ModelVersion.V3.value
        assert data["custom_det_path"] == "/custom/det.onnx"

    def test_config_error_handling(self, temp_config_path):
        """测试错误处理"""
        with open(temp_config_path, "w", encoding="utf-8") as f:
            f.write("invalid json")

        config = OCRConfig(temp_config_path)
        assert config.model_version == ModelVersion.V4.value
