const { app, BrowserWindow } = require('electron');
const DiscordRPC = require('discord-rpc');
const serve = require('electron-serve');
const electronServe = serve.default || serve;
const loadURL = electronServe({ directory: 'build' });

// Hardware acceleration is enabled by default.

const clientId = '1521582398188290049';
DiscordRPC.register(clientId);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden', // hides the title bar but keeps native Windows controls
    titleBarOverlay: {
      color: '#09090b', // matches Next.js dark theme
      symbolColor: '#ffffff',
      height: 40
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#09090b',
    autoHideMenuBar: true
  });

  // Open DevTools automatically so we can debug the blank screen
  // Developer tools are disabled for production

  loadURL(mainWindow);

  // Inject CSS to make the top bar draggable so the user can drag the window
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      /* Create a draggable area at the top of the window */
      .electron-titlebar-drag-area {
        position: fixed;
        top: 0;
        left: 0;
        right: 140px; /* Leave space for Windows controls */
        height: 40px;
        -webkit-app-region: drag;
        z-index: 99999;
        pointer-events: none; /* Let clicks pass through */
      }
    `);
    
    // Insert the draggable div
    mainWindow.webContents.executeJavaScript(`
      if (!document.getElementById('electron-drag')) {
        const dragDiv = document.createElement('div');
        dragDiv.id = 'electron-drag';
        dragDiv.className = 'electron-titlebar-drag-area';
        document.body.appendChild(dragDiv);
      }
    `);
  });

  // Intercept window.open or target="_blank" links to open them securely in the system browser
  const { shell } = require('electron');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  // Setup Auto Updater
  const { autoUpdater } = require('electron-updater');
  
  autoUpdater.on('update-downloaded', () => {
    const { dialog } = require('electron');
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of DJ Scratch has been downloaded. Restart the app to apply the updates.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Setup Auth Server for Desktop login
const http = require('http');
const url = require('url');
const fs = require('fs');

const API_BASE = 'http://localhost:3000';

const authServer = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/auth') {
    const token = parsedUrl.query.token;
    if (token && mainWindow) {
      // Send token to the React frontend
      mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('discord_jwt', '${token}');
        window.location.reload();
      `);
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="background: #09090b; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
            <h2>Authentication Successful!</h2>
            <p>You can close this tab and return to the DJ Scratch app.</p>
            <script>window.close();</script>
          </body>
        </html>
      `);
    } else {
      res.writeHead(400);
      res.end('Authentication failed: Missing token');
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

authServer.listen(43210, 'localhost', () => {
  console.log('Desktop Auth Server listening on port 43210');
});

// Setup Discord Rich Presence
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
const startTimestamp = new Date();

async function setActivity() {
  if (!rpc || !mainWindow) {
    return;
  }
  
  rpc.setActivity({
    details: 'Vibing to music',
    state: 'On DJ Scratch',
    startTimestamp,
    largeImageKey: 'logo',
    largeImageText: 'DJ Scratch',
    instance: false,
  });
}

rpc.on('ready', () => {
  setActivity();

  // activity can only be set every 15 seconds
  setInterval(() => {
    setActivity();
  }, 15e3);
});

rpc.login({ clientId }).catch(console.error);
