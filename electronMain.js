const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

const DEFAULT_WEB_APP_URL =
  process.env.APP_WEB_URL || 'https://spoonfloor.github.io/baby-eats/';

function createWindow() {
  const { width, height, x, y } = screen.getPrimaryDisplay().workArea;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // isolate renderer from Node
      nodeIntegration: false, // no require() / process in renderer
      sandbox: false,
      enableRemoteModule: false, // belt & suspenders
    },
  });

  // Desktop shell now wraps the hosted web app.
  win.loadURL(DEFAULT_WEB_APP_URL).catch((err) => {
    console.error('Failed to load hosted web app URL:', err);
  });

  // Enforce a consistent no-zoom baseline on every page load.
  // This prevents page-to-page zoom drift and guarantees zoom won't "stick"
  // across restarts (we do not persist zoom anywhere).
  win.webContents.on('did-finish-load', () => {
    try {
      win.webContents.setZoomFactor(1.0);
    } catch (_) {
      // ignore
    }
  });
}

// --- App startup ---

app.whenReady().then(() => {
  app.setName('Baby Eats');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
