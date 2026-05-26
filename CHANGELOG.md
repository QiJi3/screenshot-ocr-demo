# Changelog

本项目遵循 Keep a Changelog 格式记录版本变化。

## [1.1.0] - 2026-04-23

### Added
- ✨ OCR 模型选择面板 - 支持 v3/v4 快速切换
- 🎨 前端设置菜单 - 齿轮图标打开配置
- 🔧 后端配置系统 - `ocr_config.py` 管理模型和路径
- 📡 三个新 API 端点 - 支持前后端通信
- GET `/api/settings/ocr-config`（获取配置）
- POST `/api/settings/ocr-config`（更新配置）
- GET `/api/settings/available-models`（列出模型）
- ✅ 完整的单元测试和集成测试 - 15 个测试，93% 覆盖率
- 🎯 自定义模型支持 - 用户可指定自己的 `.onnx` 模型文件

### Improved
- 🚀 动态 OCR 引擎加载 - 支持无需重新编译更换模型
- 💾 配置持久化 - 用户偏好保存到 AppData
- 🔄 模型文件检查 - 自动检测可用的模型文件
- ⚡ 性能优化 - 异步 OCR 引擎加载，不阻塞 UI

### Fixed
- 修复模型文件不存在时的降级逻辑
- 改进错误处理和用户提示

### Technical Details
- 后端：FastAPI + `ocr_config.py` + 3 个 API 端点
- 前端：React 19.2.4 + Ant Design 6.3.5 + `SettingsPanel` 组件
- 测试：pytest 15 个测试，93% 代码覆盖率
- 模型支持：PP-OCRv3、PP-OCRv4、自定义模型

---

## [1.0.0] - 2026-03-31

### Added
- 初始版本发布
- 基础截图 OCR 功能
- Electron + FastAPI 桌面应用架构
- 本地离线识别能力
