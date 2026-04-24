/**
 * ChromaCommand Screen Player — Electron Kiosk App (Raspberry Pi 5)
 * Displays content playlists on E-Ink / LCD screens
 * Caches content offline, supports diff sync
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const WebSocket = require('ws');

// ─── Configuration ────────────────────────────────────────────────────────
const CONFIG = {
  storeId: process.env.STORE_ID || 'pp-a01',
  screenId: process.env.SCREEN_ID || 'menu-primary',
  screenType: process.env.SCREEN_TYPE || 'eink', // eink | lcd
  edgeGatewayUrl: process.env.EDGE_GATEWAY_URL || 'ws://localhost:5000/ws',
  cacheDir: process.env.CACHE_DIR || './content_cache',
  width: parseInt(process.env.SCREEN_WIDTH || (process.env.SCREEN_TYPE === 'eink' ? '1200' : '1920')),
  height: parseInt(process.env.SCREEN_HEIGHT || (process.env.SCREEN_TYPE === 'eink' ? '1600' : '1080')),
};

let mainWindow;
let wsClient;
let currentPlaylist = null;
let currentAssetIndex = 0;
let assetTimer = null;

// ─── Electron App ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: CONFIG.width,
    height: CONFIG.height,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load initial content
  mainWindow.loadURL(`data:text/html,
    <html><head><style>
      body { margin:0; padding:0; overflow:hidden; background:#1B2A4A; color:#C8A951; 
             font-family:'Inter',sans-serif; display:flex; align-items:center; justify-content:center; }
      .logo { font-size:72px; font-weight:bold; }
    </style></head><body>
      <div class="logo">Papa Pasta</div>
    </body></html>
  `);

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });

// ─── WebSocket Connection to Edge Gateway ─────────────────────────────────
function connectToGateway() {
  wsClient = new WebSocket(CONFIG.edgeGatewayUrl);
  
  wsClient.on('open', () => {
    console.log(`🔌 Screen ${CONFIG.screenId} connected to Edge Gateway`);
    // Register screen
    wsClient.send(JSON.stringify({
      type: 'register',
      screen_id: CONFIG.screenId,
      store_id: CONFIG.storeId,
      screen_type: CONFIG.screenType,
      dimensions: { width: CONFIG.width, height: CONFIG.height },
    }));
  });
  
  wsClient.on('message', (data) => {
    handleGatewayMessage(JSON.parse(data.toString()));
  });
  
  wsClient.on('close', () => {
    console.log('🔌 Disconnected — retrying in 5s...');
    setTimeout(connectToGateway, 5000);
  });
  
  wsClient.on('error', (err) => {
    console.error('WS error:', err.message);
  });
}

connectToGateway();

// ─── Gateway Message Handler ───────────────────────────────────────────────
function handleGatewayMessage(msg) {
  if (msg.type === 'content' && msg.cmd === 'set_playlist') {
    loadPlaylist(msg.playlist);
  } else if (msg.type === 'content' && msg.cmd === 'show_emergency') {
    showMessage(msg.text, msg.bgColour || '#FF0000');
  }
}

// ─── Playlist Engine ───────────────────────────────────────────────────────
function loadPlaylist(playlist) {
  currentPlaylist = playlist;
  currentAssetIndex = 0;
  playCurrentAsset();
}

function playCurrentAsset() {
  if (!currentPlaylist || !currentPlaylist.items || currentPlaylist.items.length === 0) return;
  
  const item = currentPlaylist.items[currentAssetIndex];
  const asset = getAsset(item.asset_id);
  
  if (asset) {
    renderAsset(asset);
  }
  
  // Schedule next
  const duration = (item.duration || asset?.duration_seconds || 15) * 1000;
  assetTimer = setTimeout(() => {
    currentAssetIndex = (currentAssetIndex + 1) % currentPlaylist.items.length;
    playCurrentAsset();
  }, duration);
}

// ─── Asset Rendering ───────────────────────────────────────────────────────
function renderAsset(asset) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  if (asset.type === 'html') {
    mainWindow.loadURL(`data:text/html,${asset.html_content}`);
  } else if (asset.type === 'image') {
    const html = `
      <html><head><style>
        body { margin:0; background:black; display:flex; align-items:center; justify-content:center; }
        img { max-width:100%; max-height:100%; object-fit:contain; }
      </style></head><body>
        <img src="${asset.url}" />
      </body></html>
    `;
    mainWindow.loadURL(`data:text/html,${html}`);
  } else if (asset.type === 'template') {
    // Render template with variables
    let html = asset.html_content;
    for (const [key, value] of Object.entries(asset.variables || {})) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    mainWindow.loadURL(`data:text/html,${html}`);
  }
}

function showMessage(text, bgColour) {
  if (assetTimer) clearTimeout(assetTimer);
  const html = `
    <html><head><style>
      body { margin:0; background:${bgColour}; color:white; font-family:'Inter',sans-serif;
             display:flex; align-items:center; justify-content:center; font-size:48px; text-align:center; }
    </style></head><body>
      <div>${text}</div>
    </body></html>
  `;
  mainWindow.loadURL(`data:text/html,${html}`);
}

// ─── Asset Cache (Stub) ────────────────────────────────────────────────────
function getAsset(assetId) {
  // TODO: load from local cache (SQLite or filesystem)
  // For now, return a stub
  return {
    asset_id: assetId,
    type: 'html',
    html_content: `
      <html><head><style>
        body { background:#1B2A4A; color:#C8A951; font-family:'Inter',sans-serif;
               display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; }
        h1 { font-size:64px; margin:0; }
        p { font-size:24px; opacity:0.7; }
      </style></head><body>
        <h1>Papa Pasta</h1>
        <p>Menu ID: ${assetId}</p>
      </body></html>
    `,
    duration_seconds: 30,
  };
}
