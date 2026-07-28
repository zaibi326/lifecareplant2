const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: "Life Care Plant — Gas Cylinder Plant ERP",
    icon: path.join(__dirname, "../public/icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    autoHideMenuBar: false,
    show: false,
  });

  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    const indexPath = path.join(__dirname, "../.output/public/index.html");
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      mainWindow.loadURL("http://localhost:3000");
    }
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  buildAppMenu();
}

function buildAppMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Print Document",
          accelerator: "CmdOrCtrl+P",
          click: () => {
            if (mainWindow) mainWindow.webContents.print();
          },
        },
        { type: "separator" },
        {
          label: "Export Summary...",
          click: async () => {
            if (!mainWindow) return;
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
              title: "Export ERP Summary",
              defaultPath: "Plant_ERP_Export.csv",
              filters: [{ name: "CSV Files", extensions: ["csv"] }],
            });
            if (filePath) {
              mainWindow.webContents.send("trigger-export-csv", filePath);
            }
          },
        },
        { type: "separator" },
        { role: "quit", label: "Exit ERP" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload", label: "Refresh App" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Full Screen" },
        { role: "toggleDevTools", label: "Developer Tools" },
      ],
    },
    {
      label: "Hardware",
      submenu: [
        {
          label: "Scan Barcode / QR",
          accelerator: "CmdOrCtrl+B",
          click: () => {
            if (mainWindow) mainWindow.webContents.send("trigger-barcode-scanner");
          },
        },
        {
          label: "Quick Print Receipt",
          click: () => {
            if (mainWindow) mainWindow.webContents.print();
          },
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Gas Plant ERP Support",
          click: () => {
            shell.openExternal("https://github.com/zaibi326/lifecareplant2");
          },
        },
        { type: "separator" },
        {
          label: "About Life Care Plant ERP",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About Life Care Plant ERP",
              message: "Life Care Plant ERP v2.0 (Desktop Edition)",
              detail:
                "Commercial Gas Cylinder Plant ERP with Production, Finance, Offline Sync, and Barcode Hardware integration.",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle("print-page", async () => {
  if (mainWindow) {
    mainWindow.webContents.print({ silent: false, printBackground: true });
    return true;
  }
  return false;
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
