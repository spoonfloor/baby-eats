// electronMain.js

// Electron main process — handles app lifecycle and real file I/O.

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { ensureGoogleDocsAccessToken } = require('./googleDocsAuth');
const { exportShoppingListToGoogleDocs } = require('./googleDocsExport');

// 🔧 Adjustable constants

let ACTIVE_DB_PATH = null;
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
let APP_CONFIG = {
  lastDb: null,
  googleDocsAuth: null,
};

const MAX_BACKUPS = 20;

// --- Backup helpers ---

function tsStamp(d = new Date()) {
  // local time: "YYYYMMDD-HHMMSS"
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}${MM}${DD}-${hh}${mm}${ss}`;
}

function reserveBackupPath(historyDir, base, ext) {
  const stamp = tsStamp();
  for (let n = 0; n < 100; n++) {
    const suffix = n === 0 ? '' : `-${String(n).padStart(2, '0')}`;
    const candidate = path.join(historyDir, `${base}_${stamp}${suffix}${ext}`);
    try {
      const fd = fs.openSync(candidate, 'wx'); // atomic reserve
      fs.closeSync(fd);
      return candidate;
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      throw e;
    }
  }
  throw new Error('Too many backups in the same second.');
}
function shouldMirrorDbToRepoAssets() {
  if (app.isPackaged) {
    return false;
  }
  return process.env.FAVORITE_EATS_MIRROR_ASSETS !== '0';
}

function getRepoAssetDbPath() {
  return path.join(__dirname, 'assets', 'favorite_eats.db');
}

/**
 * After a successful save to the user's DB, copy the file into `assets/favorite_eats.db`
 * for the web bundle when running unpackaged (e.g. npm start). Packaged dist builds never
 * mirror — app.asar is read-only. Set FAVORITE_EATS_MIRROR_ASSETS=0 to disable in dev.
 * If the repo asset already exists and is not the same file as the active DB, it is moved
 * to `assets/archive/` first.
 */
function mirrorDbToRepoAssets(sourcePath) {
  if (!shouldMirrorDbToRepoAssets()) {
    return { enabled: false, skipped: true, reason: 'disabled' };
  }
  if (!sourcePath || typeof sourcePath !== 'string') {
    throw new Error('Mirror source path is missing.');
  }

  const dest = getRepoAssetDbPath();
  const resolvedSource = path.resolve(sourcePath);
  const resolvedDest = path.resolve(dest);
  if (resolvedSource === resolvedDest) {
    return {
      enabled: true,
      skipped: true,
      reason: 'same-path',
      source: resolvedSource,
      dest: resolvedDest,
    };
  }

  const sourceStat = fs.statSync(resolvedSource);
  if (!sourceStat.isFile()) {
    throw new Error(`Mirror source is not a file: ${resolvedSource}`);
  }

  let archivePath = null;
  if (fs.existsSync(dest)) {
    const archiveDir = path.join(__dirname, 'assets', 'archive');
    fs.mkdirSync(archiveDir, { recursive: true });
    const ext = path.extname(dest) || '.db';
    archivePath = reserveBackupPath(archiveDir, 'favorite_eats', ext);
    fs.renameSync(dest, archivePath);
  }

  fs.copyFileSync(resolvedSource, resolvedDest);

  const destStat = fs.statSync(resolvedDest);
  if (!destStat.isFile()) {
    throw new Error(`Mirror destination is not a file: ${resolvedDest}`);
  }
  if (destStat.size !== sourceStat.size) {
    throw new Error(
      `Mirror size mismatch: source=${sourceStat.size} dest=${destStat.size}`
    );
  }

  return {
    enabled: true,
    skipped: false,
    source: resolvedSource,
    dest: resolvedDest,
    archivePath,
    bytes: sourceStat.size,
  };
}

function pruneBackups(historyDir, keepCount = MAX_BACKUPS) {
  try {
    if (!fs.existsSync(historyDir)) return;
    const files = fs
      .readdirSync(historyDir)
      .map((name) => ({ name, full: path.join(historyDir, name) }))
      .filter((f) => {
        try {
          return fs.statSync(f.full).isFile();
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        try {
          return fs.statSync(b.full).mtimeMs - fs.statSync(a.full).mtimeMs;
        } catch {
          return 0;
        }
      });
    files.slice(keepCount).forEach((f) => {
      try {
        fs.unlinkSync(f.full);
      } catch {}
    });
  } catch (e) {
    console.warn('⚠️ pruneBackups failed:', e);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // isolate renderer from Node
      nodeIntegration: false, // no require() / process in renderer
      sandbox: false, // keep one execution world (sql.js friendly)
      enableRemoteModule: false, // belt & suspenders
    },
  });

  // load your existing web app entry
  win.loadFile('index.html');

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

// --- Config helpers (remember last DB path) ---
function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const json = JSON.parse(raw);
    if (json && typeof json === 'object') {
      APP_CONFIG = {
        ...APP_CONFIG,
        ...json,
      };
    }
    if (typeof APP_CONFIG.lastDb === 'string' && fs.existsSync(APP_CONFIG.lastDb)) {
      ACTIVE_DB_PATH = APP_CONFIG.lastDb;
    }
  } catch (_) {
    // no config yet or unreadable; ignore
  }
}

function saveConfig() {
  try {
    APP_CONFIG.lastDb = ACTIVE_DB_PATH || null;
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(APP_CONFIG, null, 2));
  } catch (err) {
    console.warn('⚠️ Could not persist config:', err.message);
  }
}

function getGoogleDocsAuthConfig() {
  return APP_CONFIG.googleDocsAuth && typeof APP_CONFIG.googleDocsAuth === 'object'
    ? APP_CONFIG.googleDocsAuth
    : null;
}

function setGoogleDocsAuthConfig(nextAuth) {
  APP_CONFIG.googleDocsAuth = nextAuth && typeof nextAuth === 'object' ? nextAuth : null;
  saveConfig();
}

// --- File I/O helpers ---

ipcMain.handle('loadDB', async (event, pathArg = null) => {
  if (pathArg) {
    ACTIVE_DB_PATH = pathArg;
    saveConfig();
  }

  return fs.promises.readFile(ACTIVE_DB_PATH);
});

ipcMain.handle(
  'saveDB',
  async (event, bytes, options = { overwriteOnly: false }) => {
    let targetPath = ACTIVE_DB_PATH;
    let targetSaved = false;
    try {
      const buffer = Buffer.from(bytes);
      if (!targetPath || typeof targetPath !== 'string') {
        throw new Error('No active database selected.');
      }
      targetPath = path.resolve(targetPath);
      console.info(
        `💾 Saving DB to ${targetPath} (overwriteOnly=${options?.overwriteOnly === true}, mirror=${shouldMirrorDbToRepoAssets() ? 'on' : 'off'})`
      );
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });

      // Guard: prevent edits to backups (no recursive Backup folders)
      const isInBackupFolder = /(^|[\\/])Backup([\\/]|$)/i.test(
        path.normalize(targetPath)
      );
      if (isInBackupFolder) {
        dialog.showErrorBox(
          'Read-only Backup',
          'This file is a read-only backup. Move it out of the Backup folder to edit.'
        );
        return false;
      }

      // Optional backup step
      if (!options.overwriteOnly) {
        const BACKUP_DIR = path.join(path.dirname(targetPath), 'Backup');
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        // Back up existing on-disk DB BEFORE overwrite
        if (fs.existsSync(targetPath)) {
          const base = path.basename(targetPath, path.extname(targetPath));
          const ext = path.extname(targetPath) || '.db';
          const backupPath = reserveBackupPath(BACKUP_DIR, base, ext);
          fs.copyFileSync(targetPath, backupPath);
        }
        pruneBackups(BACKUP_DIR);
      }

      // Safer write: temp + rename
      const tmp = `${targetPath}.tmp`;
      fs.writeFileSync(tmp, buffer);
      fs.renameSync(tmp, targetPath);
      targetSaved = true;
      const mirrorResult = mirrorDbToRepoAssets(targetPath);
      if (mirrorResult.enabled) {
        if (mirrorResult.skipped) {
          console.info(
            `🪞 Mirror skipped (${mirrorResult.reason}) for ${mirrorResult.dest}`
          );
        } else {
          console.info(
            `🪞 Mirrored DB to ${mirrorResult.dest} from ${mirrorResult.source} (${mirrorResult.bytes} bytes)`
          );
          if (mirrorResult.archivePath) {
            console.info(`🗃️ Archived previous bundled DB at ${mirrorResult.archivePath}`);
          }
        }
      }
      return true;
    } catch (err) {
      console.error('❌ Save failed:', {
        targetPath,
        mirrorPath: getRepoAssetDbPath(),
        error: err,
      });
      const message =
        targetSaved && shouldMirrorDbToRepoAssets()
          ? `Saved your database, but failed to update ${getRepoAssetDbPath()}.\n\n${err.message}`
          : err.message;
      dialog.showErrorBox('Save Error', message);
      return false;
    }
  }
);
ipcMain.handle('pickDB', async (event, lastPath = null) => {
  const options = {
    title: 'Select a SQLite database',
    filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
    properties: ['openFile'],
  };

  // If we know the last used path, start there
  if (lastPath) {
    const lastDir = path.dirname(lastPath);
    if (fs.existsSync(lastDir)) {
      options.defaultPath = lastDir;
    }
  }

  const result = await dialog.showOpenDialog(options);
  if (result.canceled) return null;
  const chosen = result.filePaths[0];
  if (!chosen) return null;

  // persist selected DB for next launch
  ACTIVE_DB_PATH = chosen;
  saveConfig();

  const isInBackupFolder = /(^|[\\/])Backup([\\/]|$)/i.test(
    path.normalize(chosen)
  );
  if (isInBackupFolder) {
    await dialog.showMessageBox({
      type: 'warning',
      buttons: ['OK'],
      title: 'Read-only Backup',
      message:
        'This file is a read-only backup. Move it out of the Backup folder to edit.',
      detail:
        'You can view it now, but saving changes will be blocked until it is moved.',
    });
  }
  return chosen;
});

ipcMain.handle('getEnv', async () => ({
  appPath: app.getAppPath(),
  userData: app.getPath('userData'),
}));

ipcMain.handle('googleDocsExportShoppingList', async (event, payload = null) => {
  try {
    const accessToken = await ensureGoogleDocsAccessToken({
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      persistedAuth: getGoogleDocsAuthConfig(),
      onAuthChanged: (nextAuth) => {
        setGoogleDocsAuthConfig(nextAuth);
      },
      openExternal: (url) => shell.openExternal(url),
    });

    const exportResult = await exportShoppingListToGoogleDocs({
      accessToken,
      payload,
    });

    if (String(exportResult?.url || '').trim()) {
      try {
        await shell.openExternal(exportResult.url);
      } catch (openErr) {
        console.warn('⚠️ Could not open exported Google Doc automatically:', openErr);
      }
    }

    return {
      ok: true,
      ...exportResult,
    };
  } catch (err) {
    console.error('❌ Google Docs export failed:', err);
    return {
      ok: false,
      code: String(err?.code || 'google_docs_export_failed'),
      message: String(err?.userMessage || err?.message || 'Could not export shopping list.'),
    };
  }
});

// --- App startup ---

app.whenReady().then(() => {
  loadConfig();

  // macOS: set dock icon in dev and prod

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
