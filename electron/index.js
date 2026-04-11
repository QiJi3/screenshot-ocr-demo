const { app, BrowserWindow, desktopCapturer, screen, Menu, shell, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const APP_TITLE = '截图 OCR Demo';
const UPLOAD_LABEL = '上传识别';
const BACKEND_PORT = 8000;
const SCREENSHOT_INTERVAL = 10000;
const HEALTH_CHECK_INTERVAL_MS = 1000;
const HEALTH_CHECK_TIMEOUT_MS = 45000;

let mainWindow;
let pythonProcess;
let captureMode = 'screen';
let SCREENSHOT_DIR;

const isPackaged = app.isPackaged;
const resourcesPath = isPackaged ? process.resourcesPath : path.join(__dirname, '..');

// Packaged mode: use compiled backend.exe; dev mode: use python .venv
const BACKEND_EXE_DIR = isPackaged
  ? path.join(resourcesPath, 'backend_exe')
  : path.join(resourcesPath, 'backend');
const BACKEND_EXE = isPackaged
  ? path.join(BACKEND_EXE_DIR, 'backend.exe')
  : null;
const BACKEND_PYTHON = isPackaged
  ? null
  : path.join(BACKEND_EXE_DIR, '.venv', 'Scripts', 'python.exe');
const BACKEND_SCRIPT = isPackaged
  ? null
  : path.join(BACKEND_EXE_DIR, 'main.py');
const FRONTEND_DIST = path.join(resourcesPath, 'frontend', 'dist');
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const BACKEND_LOG_PATH = path.join(LOG_DIR, 'backend.log');
const APP_LOG_PATH = path.join(LOG_DIR, 'app.log');

function ensureDir(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function appendLog(targetPath, message) {
  try {
    ensureDir(path.dirname(targetPath));
    fs.appendFileSync(targetPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch (error) {
    console.error('appendLog failed', error);
  }
}

function logApp(message) {
  appendLog(APP_LOG_PATH, message);
  console.log(message);
}

function showFatalError(title, detail) {
  logApp(`${title}: ${detail}`);
  dialog.showErrorBox(title, detail);
}

function waitForBackend() {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - startedAt >= HEALTH_CHECK_TIMEOUT_MS) {
          clearInterval(timer);
          reject(new Error(`backend_health_timeout_status_${res.statusCode}`));
        }
      }).on('error', () => {
        if (Date.now() - startedAt >= HEALTH_CHECK_TIMEOUT_MS) {
          clearInterval(timer);
          reject(new Error('backend_health_timeout'));
        }
      });
    }, HEALTH_CHECK_INTERVAL_MS);
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const bin = isPackaged ? BACKEND_EXE : BACKEND_PYTHON;
    const args = isPackaged ? [] : [BACKEND_SCRIPT];

    if (!fs.existsSync(bin)) {
      reject(new Error(`backend_missing: ${bin}`));
      return;
    }
    if (!isPackaged && !fs.existsSync(BACKEND_SCRIPT)) {
      reject(new Error(`backend_script_missing: ${BACKEND_SCRIPT}`));
      return;
    }

    ensureDir(LOG_DIR);
    fs.writeFileSync(BACKEND_LOG_PATH, '', 'utf8');
    logApp(`Starting backend: ${bin}`);
    logApp(`Frontend dist: ${FRONTEND_DIST}`);

    pythonProcess = spawn(bin, args, {
      cwd: BACKEND_EXE_DIR,
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        SCREENSHOTS_DIR: SCREENSHOT_DIR,
        FRONTEND_DIR: FRONTEND_DIST,
        DB_PATH: path.join(app.getPath('userData'), 'ocr_records.db'),
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    pythonProcess.stdout.on('data', (data) => {
      appendLog(BACKEND_LOG_PATH, `stdout: ${data.toString()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      appendLog(BACKEND_LOG_PATH, `stderr: ${data.toString()}`);
    });

    pythonProcess.on('error', (error) => {
      logApp(`Backend process error: ${error.stack || error.message}`);
      reject(error);
    });

    pythonProcess.on('close', (code) => {
      logApp(`Backend process exited with code ${code}`);
    });

    waitForBackend()
      .then(resolve)
      .catch((error) => {
        reject(error);
      });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: APP_TITLE,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadFile(path.join(__dirname, 'loading.html'));
}

async function takeScreenshotAndProcess() {
  try {
    ensureDir(SCREENSHOT_DIR);

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const types = captureMode === 'window' ? ['window'] : ['screen'];
    const sources = await desktopCapturer.getSources({
      types,
      thumbnailSize: { width: Math.max(width, 1), height: Math.max(height, 1) },
      fetchWindowIcons: false,
    });

    const source = captureMode === 'window'
      ? sources.find((item) => !item.thumbnail.isEmpty() && item.name !== APP_TITLE)
      : sources[0];

    if (!source || source.thumbnail.isEmpty()) {
      logApp('No screenshot source available');
      return;
    }

    const timestamp = Date.now();
    const filename = `screenshot_${timestamp}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(filepath, source.thumbnail.toPNG());
    logApp(`Screenshot saved to ${filepath}`);

    const postData = JSON.stringify({ file_name: filename });
    const request = http.request({
      hostname: '127.0.0.1',
      port: BACKEND_PORT,
      path: '/captures/process',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        logApp(`OCR Result: ${responseData}`);
      });
    });

    request.on('error', (error) => {
      logApp(`OCR request failed: ${error.message}`);
    });

    request.write(postData);
    request.end();
  } catch (error) {
    logApp(`Failed to take screenshot: ${error.stack || error.message}`);
  }
}

ipcMain.on('set-capture-mode', (_, mode) => {
  captureMode = mode;
  logApp(`Capture mode set to: ${mode}`);
});

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '在浏览器中打开',
          accelerator: 'CmdOrCtrl+B',
          click: () => shell.openExternal(`http://127.0.0.1:${BACKEND_PORT}`),
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '设置',
      submenu: [
        {
          label: 'OCR 参数设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('open-settings');
          },
        },
        { type: 'separator' },
        {
          label: `${UPLOAD_LABEL}（上传图片识别）`,
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('open-demo');
          },
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: '重做', role: 'redo', accelerator: 'CmdOrCtrl+Y' },
        { type: 'separator' },
        { label: '剪切', role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: '复制', role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: '粘贴', role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { label: '全选', role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: '查看',
      submenu: [
        { label: '刷新', role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { label: '强制刷新', role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { label: '开发者工具', role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { label: '放大', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: '缩小', role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen', accelerator: 'F11' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize', accelerator: 'CmdOrCtrl+M' },
        { label: '关闭', role: 'close', accelerator: 'CmdOrCtrl+W' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox({
              title: APP_TITLE,
              message: `${APP_TITLE} v1.0.0`,
              detail: '每 10 秒自动截图，本地 OCR 识别，结果存入 SQLite。',
              buttons: ['确定'],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  SCREENSHOT_DIR = path.join(app.getPath('userData'), 'screenshots');
  ensureDir(LOG_DIR);
  logApp(`App started. isPackaged=${isPackaged}`);

  buildMenu();
  createWindow();

  startBackend()
    .then(async () => {
      logApp('Backend is ready');
      if (mainWindow) {
        mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
      }
      await takeScreenshotAndProcess();
      setInterval(takeScreenshotAndProcess, SCREENSHOT_INTERVAL);
    })
    .catch((error) => {
      showFatalError('启动失败', error.stack || error.message);
      app.quit();
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (pythonProcess && pythonProcess.pid) {
    try {
      require('child_process').execSync(`taskkill /pid ${pythonProcess.pid} /T /F`);
    } catch (error) {
      logApp(`Failed to kill backend process: ${error.message}`);
    }
  }
});
