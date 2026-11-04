import { app, BrowserWindow } from 'electron';
import path from 'path';
import { dbInstance } from './db/database';
import { DatabaseMigrator } from './db/migrator';
import { registerIpcHandlers } from './ipc/handlers';
import { BackupService } from './services/backup.service';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  // Initialize SQLite database and run versioned migrations
  console.log('Initializing database...');
  await dbInstance.initialize();
  await DatabaseMigrator.runMigrations(dbInstance);
  console.log('Database ready.');

  // Auto-backup daily on start
  try {
    const backupService = new BackupService();
    backupService.createBackup(true);
    console.log('Automatic daily backup performed.');
  } catch (err) {
    console.error('Initial auto-backup failed:', err);
  }

  // Register IPC handlers
  registerIpcHandlers();

  // Create Window
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Patient Booking Register',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  dbInstance.persistImmediate();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Clean up DB on exit
app.on('before-quit', () => {
  dbInstance.persistImmediate();
});
