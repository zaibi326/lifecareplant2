const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  printPage: () => ipcRenderer.invoke("print-page"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  onExportCsv: (callback) =>
    ipcRenderer.on("trigger-export-csv", (_event, filePath) => callback(filePath)),
  onBarcodeScanner: (callback) => ipcRenderer.on("trigger-barcode-scanner", () => callback()),
});
