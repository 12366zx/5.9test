const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 580,
    resizable: true,
    minWidth: 360,
    minHeight: 520,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Create a simple 16x16 tray icon (red circle on transparent bg, BGRA for Windows)
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2, r = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (dist <= r) {
        canvas[i] = 60;      // B
        canvas[i + 1] = 76;  // G
        canvas[i + 2] = 231; // R
        canvas[i + 3] = 255; // A
      }
    }
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏', click: () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    },
    { type: 'separator' },
    {
      label: '退出', click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('番茄钟');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

// IPC handlers
ipcMain.on('timer-completed', (_event, mode) => {
  const labels = { work: '工作结束！', shortBreak: '短休结束！', longBreak: '长休结束！' };
  if (Notification.isSupported()) {
    new Notification({
      title: '番茄钟',
      body: labels[mode] || '时间到！休息一下吧。',
      silent: false,
    }).show();
  }
  if (process.platform === 'win32') {
    mainWindow.flashFrame(true);
  }
  mainWindow.show();
});

ipcMain.on('set-always-on-top', (_event, flag) => {
  mainWindow.setAlwaysOnTop(flag);
});

ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  mainWindow.hide();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Don't quit on Windows — keep running in tray
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
