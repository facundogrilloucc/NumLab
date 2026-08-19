import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
	const window = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1024,
		minHeight: 700,
		show: false,
		backgroundColor: "#080b12",
		icon: path.join(__dirname, "../src/icon.png"),
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	window.once("ready-to-show", () => window.show());
	window.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
