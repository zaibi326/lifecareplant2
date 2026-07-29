const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const http = require("http");

let mainWindow = null;
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function findFreePort(startPort, cb) {
  const server = net.createServer();
  server.listen(startPort, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => cb(port));
  });
  server.on("error", () => {
    findFreePort(startPort + 1, cb);
  });
}

async function startEmbeddedServer(port, callback) {
  const candidatePaths = [
    path.join(__dirname, "../.output/server/index.mjs"),
    path.join(process.resourcesPath, "app", ".output", "server", "index.mjs"),
    path.join(process.resourcesPath, ".output", "server", "index.mjs"),
  ];

  let serverScript = candidatePaths.find((p) => fs.existsSync(p));

  if (serverScript) {
    console.log("[ELECTRON MAIN] Importing Nitro server in-process on port:", port, "from:", serverScript);
    process.env.PORT = String(port);
    process.env.HOST = "127.0.0.1";
    process.env.NITRO_PORT = String(port);
    process.env.NITRO_HOST = "127.0.0.1";
    const appDir = path.dirname(path.dirname(serverScript));
    try {
      process.chdir(appDir);
    } catch (e) {
      console.warn("[ELECTRON MAIN] Could not change dir to:", appDir, e);
    }
    try {
      const fileUrl = require("url").pathToFileURL(serverScript).href;
      await import(fileUrl);
      console.log("[ELECTRON MAIN] Nitro server imported successfully.");
    } catch (err) {
      console.error("[ELECTRON MAIN] Error importing Nitro server:", err);
    }
  } else {
    console.warn("[ELECTRON MAIN] Server script not found in candidates:", candidatePaths);
  }

  let attempts = 0;
  const poll = () => {
    const req = http.get(`http://127.0.0.1:${port}`, (res) => {
      console.log("[ELECTRON MAIN] Embedded server ready at:", `http://127.0.0.1:${port}`);
      callback(`http://127.0.0.1:${port}`);
    });
    req.on("error", () => {
      attempts++;
      if (attempts < 60) {
        setTimeout(poll, 150);
      } else {
        callback(`http://127.0.0.1:${port}`);
      }
    });
  };
  poll();
}

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
      webSecurity: false,
    },
    autoHideMenuBar: false,
    show: false,
  });

  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      mainWindow.webContents.openDevTools();
    });
  } else {
    findFreePort(3855, (port) => {
      startEmbeddedServer(port, (url) => {
        mainWindow.loadURL(url);
        mainWindow.once("ready-to-show", () => {
          mainWindow.show();
          mainWindow.webContents.openDevTools();
        });
      });
    });
  }

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error("[ELECTRON MAIN] Page failed to load:", errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
        shell.openExternal(url);
        return { action: "deny" };
      }
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
