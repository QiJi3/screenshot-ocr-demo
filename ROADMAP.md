# Roadmap

## v1.1.0（下个版本）

### 1. 窗口选择（类 OBS 风格）
- 当前：捕获模式为「窗口」时随机取第一个非自身窗口
- 目标：弹出窗口选择列表（缩略图 + 窗口名），用户手动选择要监控的窗口
- 实现方向：`desktopCapturer.getSources({ types: ['window'] })` 返回所有窗口，前端用 Modal 展示选择

### 2. OCR 结果按窗口分组展示
- 当前：全屏截图识别后，所有文字混在一个文本块里
- 目标：识别结果按窗口区域分段展示，每个窗口对应一块内容区
- 实现方向：结合窗口坐标信息对识别结果做区域分组，仪表盘卡片化展示

### 3. 便携版卸载脚本
- 当前：zip 便携版解压后无清理机制
- 目标：随 zip 附带一个 `uninstall.bat` 或 `uninstall.ps1`，执行后清理 AppData 里的 userData（截图、数据库、日志）

### 4. OCR 模型优化
- 默认换成 PP-OCRv4（当前默认是 PP-OCRv3，PP-OCRv4 仅在手动放模型文件时才启用）
- 在设置面板里加「模型选择」下拉：内置 v3 / 内置 v4 / 自定义路径
- 自定义路径支持用户指定本地 .onnx 文件

### 5. 版本号管理
- 下次发版前必须更新 `electron/package.json` 里的 `version` 字段
- Release tag 同步改为 `v1.1.0`

---

## 已完成 ✅

- v1.0.0：PyInstaller 独立 backend.exe，zip + nsis 双格式，loading 启动页
