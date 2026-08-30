require('electron-unhandled')();

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const dialog = electron.dialog;
const session = electron.session;

const fs = require('fs');
const path = require('path');

const nodeMachineId = require('node-machine-id');
const machineIdSync = nodeMachineId.machineIdSync;

let mainWindow;

// Map global para rastrear y gestionar instancias completas de navegadores activos
const perfilesActivos = new Map();

// User-Agents de escritorio para la selección "Aleatorio"
const RANDOM_DESKTOP_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
];

/**
 * Rutas seguras en AppData para prevenir errores de permisos de escritura en Program Files.
 */
function getUserDataPath() {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  return userDataPath;
}

function getPerfilesFilePath() {
  return path.join(getUserDataPath(), 'perfiles.json');
}

function getClientesFilePath() {
  return path.join(getUserDataPath(), 'clientes.json');
}

function getProfileDirPath(id) {
  const profileDir = path.join(getUserDataPath(), 'perfiles', 'perfil-' + id);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  return profileDir;
}

/**
 * Rutina silenciosa para depurar y eliminar archivos y carpetas obsoletas en __dirname.
 */
function depurarArchivosAntiguos() {
  try {
    const legacyFiles = [
      path.join(__dirname, 'perfiles.json'),
      path.join(__dirname, 'clientes.json')
    ];

    legacyFiles.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`[LIMPIEZA DEPURACIÓN] Archivo heredado eliminado: ${filePath}`);
        } catch (e) {
          console.warn(`[LIMPIEZA WARNING] No se pudo eliminar ${filePath}: ${e.message}`);
        }
      }
    });

    const legacyDir = path.join(__dirname, 'perfiles');
    if (fs.existsSync(legacyDir)) {
      try {
        fs.rmSync(legacyDir, { recursive: true, force: true });
        console.log(`[LIMPIEZA DEPURACIÓN] Carpeta heredada eliminada: ${legacyDir}`);
      } catch (e) {
        console.warn(`[LIMPIEZA WARNING] No se pudo eliminar carpeta heredada: ${e.message}`);
      }
    }
  } catch (err) {
    console.error("[LIMPIEZA ERROR]", err);
  }
}

/**
 * Búsqueda exhaustiva de Google Chrome o Brave en el sistema para prevenir clonado de Electron.
 */
function getSystemChromePath() {
  const paths = [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe')
  ];
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error('No se encontró Google Chrome ni Brave en las rutas estándar del sistema.');
}

/**
 * Lee la lista de perfiles desde AppData/perfiles.json.
 */
function cargarPerfiles() {
  const perfilesFile = getPerfilesFilePath();
  try {
    if (!fs.existsSync(perfilesFile)) {
      const perfilesIniciales = [
        { 
          id: '1830', 
          nombre: 'CHATGPT PRO', 
          etiqueta: 'IA MAXIMA',
          categoria: 'Inteligencia Artificial',
          etiquetaColor: '#5BC0BE',
          urlAviso: '',
          proxy: '', 
          proxyHost: '',
          proxyPort: '',
          proxyUser: '',
          proxyPass: '',
          osTarget: 'Windows',
          userAgent: RANDOM_DESKTOP_UAS[0],
          cookie: '', 
          syncStatus: 'local', 
          cloudId: null 
        },
        { 
          id: '1831', 
          nombre: 'CLAUDE AI WORK', 
          etiqueta: 'IA INVESTIGACION',
          categoria: 'Inteligencia Artificial',
          etiquetaColor: '#6FFFE9',
          urlAviso: '',
          proxy: '', 
          proxyHost: '',
          proxyPort: '',
          proxyUser: '',
          proxyPass: '',
          osTarget: 'macOS',
          userAgent: RANDOM_DESKTOP_UAS[1],
          cookie: '', 
          syncStatus: 'local', 
          cloudId: null 
        }
      ];
      fs.writeFileSync(perfilesFile, JSON.stringify(perfilesIniciales, null, 2), 'utf-8');
      return perfilesIniciales;
    }
    const rawData = fs.readFileSync(perfilesFile, 'utf-8');
    const perfiles = JSON.parse(rawData);
    
    let huboCambio = false;
    perfiles.forEach(p => {
      if (!p.hasOwnProperty('categoria')) { p.categoria = 'General'; huboCambio = true; }
      if (!p.hasOwnProperty('etiquetaColor')) { p.etiquetaColor = '#5BC0BE'; huboCambio = true; }
      if (!p.hasOwnProperty('urlAviso')) { p.urlAviso = ''; huboCambio = true; }
      if (!p.hasOwnProperty('syncStatus')) { p.syncStatus = 'local'; huboCambio = true; }
      if (!p.hasOwnProperty('cloudId')) { p.cloudId = null; huboCambio = true; }
    });

    if (huboCambio) guardarPerfiles(perfiles);
    return perfiles;
  } catch (error) {
    console.error("[PERSISTENCIA] Error al leer perfiles.json:", error);
    return [];
  }
}

function guardarPerfiles(perfiles) {
  try {
    fs.writeFileSync(getPerfilesFilePath(), JSON.stringify(perfiles, null, 2), 'utf-8');
  } catch (error) {
    console.error("[PERSISTENCIA] Error al guardar perfiles.json:", error);
  }
}

/**
 * Lee la lista de clientes desde AppData/clientes.json.
 */
function cargarClientes() {
  const clientesFile = getClientesFilePath();
  try {
    if (!fs.existsSync(clientesFile)) {
      const clientesIniciales = [
        { 
          id: 'c101', 
          usuario: 'alpha_user',
          password: 'password123',
          nombre: 'alpha_user', 
          fechaInicio: new Date().toISOString(),
          fechaVencimiento: '2026-12-31T23:59',
          perfilesAsignados: ['1830', '1831'],
          hwidVinculado: null,
          syncStatus: 'local',
          cloudId: null
        }
      ];
      fs.writeFileSync(clientesFile, JSON.stringify(clientesIniciales, null, 2), 'utf-8');
      return clientesIniciales;
    }
    const rawData = fs.readFileSync(clientesFile, 'utf-8');
    const clientes = JSON.parse(rawData);

    let huboCambio = false;
    clientes.forEach(c => {
      if (!c.hasOwnProperty('usuario')) { c.usuario = c.nombre || `user_${c.id}`; huboCambio = true; }
      if (!c.hasOwnProperty('password')) { c.password = '1234'; huboCambio = true; }
      if (!c.hasOwnProperty('fechaInicio')) { c.fechaInicio = new Date().toISOString(); huboCambio = true; }
      if (!c.hasOwnProperty('hwidVinculado')) { c.hwidVinculado = null; huboCambio = true; }
      if (!c.hasOwnProperty('syncStatus')) { c.syncStatus = 'local'; huboCambio = true; }
      if (!c.hasOwnProperty('cloudId')) { c.cloudId = null; huboCambio = true; }
    });

    if (huboCambio) guardarClientes(clientes);
    return clientes;
  } catch (error) {
    console.error("[PERSISTENCIA] Error al leer clientes.json:", error);
    return [];
  }
}

function guardarClientes(clientes) {
  try {
    fs.writeFileSync(getClientesFilePath(), JSON.stringify(clientes, null, 2), 'utf-8');
  } catch (error) {
    console.error("[PERSISTENCIA] Error al guardar clientes.json:", error);
  }
}

/**
 * Función para obtener el HWID único del equipo.
 */
function obtenerYVerificarHWID() {
  try {
    const hwid = machineIdSync();
    console.log("================================================");
    console.log(" [100PREPREMIUM] HWID de la máquina:");
    console.log(` HWID: ${hwid}`);
    console.log("================================================");
    return hwid;
  } catch (error) {
    console.error("[ERROR HWID] No se pudo obtener el identificador:", error);
    return "DESCONOCIDO-HWID-ERROR";
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    title: "100prepremium v2.0 - Antidetect Suite",
    backgroundColor: '#0B132B',
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');

  const logToFrontend = (message, type = 'info') => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-message', `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`);
    }
  };

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = (...args) => {
    originalConsoleLog(...args);
    logToFrontend(args.join(' '));
  };

  console.error = (...args) => {
    originalConsoleError(...args);
    logToFrontend(args.join(' '), 'error');
  };

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ciclo de vida de Electron
app.whenReady().then(() => {
  depurarArchivosAntiguos();
  const hwid = obtenerYVerificarHWID();

  ipcMain.handle('get-hwid', () => hwid);

  // LOGIN CON ARQUITECTURA DE ROLES (superadmin, admin, cliente)
  ipcMain.handle('login', async (_event, credentials) => {
    const creds = credentials || {};
    const usuarioInput = creds.usuario ? creds.usuario.trim() : '';
    const passwordInput = creds.password ? creds.password.trim() : '';

    if (!usuarioInput || !passwordInput) {
      return { success: false, mensaje: "Ingresa usuario y contraseña" };
    }

    if (usuarioInput === 'superadmin' && passwordInput === '1234') {
      return { success: true, role: 'superadmin', usuario: 'superadmin', mensaje: "Bienvenido Superadmin" };
    }

    if (usuarioInput === 'admin' && passwordInput === '1234') {
      return { success: true, role: 'admin', usuario: 'admin', mensaje: "Bienvenido Administrador" };
    }

    const clientes = cargarClientes();
    const clienteEncontrado = clientes.find(c => (c.usuario && c.usuario.trim() === usuarioInput) || (c.nombre && c.nombre.trim() === usuarioInput));

    if (clienteEncontrado) {
      if (clienteEncontrado.password === passwordInput) {
        if (clienteEncontrado.fechaVencimiento) {
          const timestampVencimiento = new Date(clienteEncontrado.fechaVencimiento).getTime();
          if (!isNaN(timestampVencimiento) && Date.now() > timestampVencimiento) {
            return { success: false, mensaje: "Tu suscripción ha expirado. Contacta al soporte." };
          }
        }

        return { 
          success: true, 
          role: 'cliente', 
          usuario: clienteEncontrado.usuario,
          perfilesAsignados: clienteEncontrado.perfilesAsignados || [],
          mensaje: "Acceso concedido como Cliente" 
        };
      } else {
        return { success: false, mensaje: "Contraseña incorrecta." };
      }
    }

    return { success: false, mensaje: "Usuario no registrado." };
  });

  // ---------------------------------------------------------
  // HANDLERS IPC DE PERFILES
  // ---------------------------------------------------------
  ipcMain.handle('obtener-perfiles', async () => cargarPerfiles());

  ipcMain.handle('crear-perfil', async (_event, nuevoPerfilData) => {
    try {
      const perfiles = cargarPerfiles();
      const nuevoId = (Date.now() % 100000).toString().padStart(4, '0');
      
      const nuevoPerfil = {
        id: nuevoId,
        nombre: nuevoPerfilData.nombre || `Perfil ${nuevoId}`,
        etiqueta: nuevoPerfilData.etiqueta || 'GENERAL',
        categoria: nuevoPerfilData.categoria || 'General',
        etiquetaColor: nuevoPerfilData.etiquetaColor || '#5BC0BE',
        urlAviso: nuevoPerfilData.urlAviso ? nuevoPerfilData.urlAviso.trim() : '',
        proxy: nuevoPerfilData.proxy ? nuevoPerfilData.proxy.trim() : '',
        proxyHost: nuevoPerfilData.proxyHost || '',
        proxyPort: nuevoPerfilData.proxyPort || '',
        proxyUser: nuevoPerfilData.proxyUser || '',
        proxyPass: nuevoPerfilData.proxyPass || '',
        osTarget: nuevoPerfilData.osTarget || 'Aleatorio',
        userAgent: nuevoPerfilData.userAgent || '',
        cookie: nuevoPerfilData.cookie ? nuevoPerfilData.cookie.trim() : '',
        syncStatus: 'local',
        cloudId: null
      };

      perfiles.push(nuevoPerfil);
      guardarPerfiles(perfiles);
      console.log(`[CRUD PERFILES] Perfil ${nuevoId} registrado.`);
      return { success: true, perfiles: perfiles };
    } catch (err) {
      console.error('[CRUD PERFILES ERROR]', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('clonar-perfil', async (_event, idOriginal) => {
    try {
      const perfiles = cargarPerfiles();
      const original = perfiles.find(p => p.id === idOriginal.toString());
      if (!original) {
        return { success: false, message: 'Perfil original no encontrado.' };
      }

      const nuevoId = (Date.now() % 100000).toString().padStart(4, '0');
      const copiaPerfil = Object.assign({}, original, {
        id: nuevoId,
        nombre: `${original.nombre} (Copia)`,
        syncStatus: 'local',
        cloudId: null
      });

      perfiles.push(copiaPerfil);
      guardarPerfiles(perfiles);

      const profilePath = getProfileDirPath(nuevoId);

      console.log(`[CLONAR PERFIL] Perfil ${idOriginal} clonado a ID ${nuevoId} en AppData: ${profilePath}`);
      return { success: true, perfiles: perfiles };
    } catch (err) {
      console.error('[CLONAR PERFIL ERROR]', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('exportar-perfil', async (_event, id) => {
    try {
      const perfiles = cargarPerfiles();
      const perfil = perfiles.find(p => p.id === id.toString());
      if (!perfil) {
        return { success: false, message: 'Perfil no encontrado.' };
      }

      const safeName = perfil.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: `Exportar Perfil ${perfil.nombre}`,
        defaultPath: `perfil-${perfil.id}-${safeName}.json`,
        filters: [{ name: 'Ficheros JSON', extensions: ['json'] }]
      });

      const canceled = saveResult ? saveResult.canceled : true;
      const filePath = saveResult ? saveResult.filePath : null;

      if (canceled || !filePath) {
        return { success: false, message: 'Exportación cancelada.' };
      }

      fs.writeFileSync(filePath, JSON.stringify(perfil, null, 2), 'utf-8');
      return { success: true, filePath: filePath };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('eliminar-perfil', async (_event, id) => {
    try {
      const idStr = id.toString();
      if (perfilesActivos.has(idStr)) {
        const browser = perfilesActivos.get(idStr);
        try {
          if (browser && browser.isConnected()) await browser.close();
        } catch (e) {}
        perfilesActivos.delete(idStr);
      }

      let perfiles = cargarPerfiles();
      perfiles = perfiles.filter(p => p.id !== idStr);
      guardarPerfiles(perfiles);

      const profilePath = getProfileDirPath(idStr);
      if (fs.existsSync(profilePath)) {
        try {
          fs.rmSync(profilePath, { recursive: true, force: true });
          console.log(`[CRUD PERFILES] Carpeta física destruida para perfil ${idStr}: ${profilePath}`);
        } catch (rmErr) {
          console.warn(`[CRUD PERFILES WARNING] No se pudo borrar carpeta de perfil ${idStr}: ${rmErr.message}`);
        }
      }

      return { success: true, perfiles: perfiles };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ---------------------------------------------------------
  // CAPTURA DE COOKIES NATIVA
  // ---------------------------------------------------------
  ipcMain.handle('capturar-cookies-manual', async (_event, targetUrl) => {
    const destinationUrl = targetUrl || 'https://chatgpt.com';
    try {
      const captureSession = session.fromPartition('persist:capture-temp-' + Date.now());
      const captureWin = new BrowserWindow({
        width: 1100,
        height: 750,
        title: "100prepremium - Captura de Sesión",
        backgroundColor: '#0B132B',
        webPreferences: {
          session: captureSession,
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      captureWin.setMenuBarVisibility(false);
      await captureWin.loadURL(destinationUrl);

      return new Promise((resolve) => {
        captureWin.on('closed', async () => {
          try {
            const cookies = await captureSession.cookies.get({});
            resolve({ success: true, cookies: JSON.stringify(cookies), count: cookies.length });
          } catch (err) {
            resolve({ success: false, message: err.message });
          }
        });
      });
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ---------------------------------------------------------
  // VALIDADOR DINÁMICO DE PROXIES NATIVO
  // ---------------------------------------------------------
  ipcMain.handle('verificar-proxy', async (_event, rawProxy) => {
    if (!rawProxy || !rawProxy.trim()) {
      return { success: false, message: 'La URL del proxy está vacía.' };
    }

    let proxyUrl = rawProxy.trim();
    if (!proxyUrl.startsWith('http://') && !proxyUrl.startsWith('https://') && !proxyUrl.startsWith('socks5://')) {
      proxyUrl = `http://${proxyUrl}`;
    }

    try {
      const testSession = session.fromPartition('test-proxy-' + Date.now());
      await testSession.setProxy({ proxyRules: proxyUrl });
      const resp = await testSession.fetch('https://api.ipify.org', { timeout: 10000 });
      if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
      const ipText = await resp.text();
      return { success: true, ip: ipText.trim() };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ---------------------------------------------------------
  // GESTIÓN DE CLIENTES
  // ---------------------------------------------------------
  ipcMain.handle('obtener-clientes', async () => cargarClientes());

  ipcMain.handle('crear-cliente', async (_event, clienteData) => {
    try {
      const clientes = cargarClientes();
      const nuevoId = 'c' + (Date.now() % 10000).toString();

      const usuarioVal = clienteData.usuario ? clienteData.usuario.trim() : `user_${nuevoId}`;
      const nuevoCliente = {
        id: nuevoId,
        usuario: usuarioVal,
        password: clienteData.password || '1234',
        nombre: usuarioVal,
        fechaInicio: clienteData.fechaInicio || new Date().toISOString(),
        fechaVencimiento: clienteData.fechaVencimiento || '2026-12-31T23:59',
        perfilesAsignados: clienteData.perfilesAsignados || [],
        hwidVinculado: null,
        syncStatus: 'local',
        cloudId: null
      };

      clientes.push(nuevoCliente);
      guardarClientes(clientes);
      console.log(`[CRUD CLIENTES] Cliente registrado: ${usuarioVal}`);
      return { success: true, clientes: clientes };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('desvincular-hwid-cliente', async (_event, idCliente) => {
    try {
      const clientes = cargarClientes();
      const cliente = clientes.find(c => c.id === idCliente.toString());
      if (cliente) {
        cliente.hwidVinculado = null;
        guardarClientes(clientes);
        console.log(`[HWID SEGURIDAD] HWID desvinculado para el cliente ${idCliente}`);
        return { success: true, clientes: clientes };
      }
      return { success: false, message: 'Cliente no encontrado.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('eliminar-cliente', async (_event, id) => {
    try {
      let clientes = cargarClientes();
      clientes = clientes.filter(c => c.id !== id.toString());
      guardarClientes(clientes);
      return { success: true, clientes: clientes };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // ---------------------------------------------------------
  // MANEJADOR PARA ABRIR PERFIL (OPCIÓN B: NAVEGACIÓN NATIVA ELECTRON CON SESSION PARTITION)
  // ---------------------------------------------------------
  ipcMain.handle('abrir-perfil', async (event, id, proxyStr) => {
    const idStr = id ? id.toString() : '';
    if (perfilesActivos.has(idStr)) return { success: true, message: 'El perfil ya está ejecutándose.' };

    try {
      const perfiles = cargarPerfiles();
      const perfilData = perfiles.find(p => p.id === idStr);

      // Crear ventana nativa aislada
      const winPerfil = new BrowserWindow({
        width: 1280,
        height: 800,
        parent: mainWindow, // Vincula a la ventana principal
        title: `100prepremium - Perfil ${idStr}`,
        backgroundColor: '#0B132B',
        webPreferences: {
          partition: 'persist:perfil-' + idStr, // El aislamiento mágico
          contextIsolation: true,
          nodeIntegration: false,
          webviewTag: true
        }
      });

      winPerfil.setMenuBarVisibility(false); // Ocultar menú para look limpio

      // Configurar Proxy en la sesión aislada si existe
      const perfilSession = session.fromPartition('persist:perfil-' + idStr);

      let effectiveProxy = proxyStr;
      if (!effectiveProxy && perfilData && perfilData.proxy) {
        effectiveProxy = perfilData.proxy.trim();
      }

      if (effectiveProxy) {
        if (!effectiveProxy.startsWith('http://') && !effectiveProxy.startsWith('https://') && !effectiveProxy.startsWith('socks5://')) {
          effectiveProxy = `http://${effectiveProxy}`;
        }
        await perfilSession.setProxy({ proxyRules: effectiveProxy });
      }

      if (perfilData && perfilData.proxyUser && perfilData.proxyPass) {
        winPerfil.webContents.on('login', (event, details, authInfo, callback) => {
          event.preventDefault();
          callback(perfilData.proxyUser, perfilData.proxyPass);
        });
      }

      // Guardar en estado activo y manejar el cierre de la ventana
      perfilesActivos.set(idStr, winPerfil);
      winPerfil.on('closed', () => {
        perfilesActivos.delete(idStr);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('perfil-actualizado', { id: idStr, estado: 'cerrado' });
        }
      });

      // Cargar la página inicial deseada
      let targetUrl = 'https://misuscripcion.100prepremium.com/';
      if (perfilData && perfilData.urlAviso && perfilData.urlAviso.trim() !== '') {
        targetUrl = perfilData.urlAviso.trim();
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = `https://${targetUrl}`;
        }
      }

      const particionStr = 'persist:perfil-' + idStr;
      winPerfil.loadFile('navegador.html', { query: { url: targetUrl, partition: particionStr } });

      return { success: true };
    } catch (error) {
      console.error("Error abriendo perfil nativo:", error);
      perfilesActivos.delete(id ? id.toString() : '');
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cerrar-perfil', async (event, id) => {
    const idStr = id ? id.toString() : '';
    const winPerfil = perfilesActivos.get(idStr);
    if (winPerfil) {
      if (!winPerfil.isDestroyed()) winPerfil.close();
      perfilesActivos.delete(idStr);
    }
    return { success: true };
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

async function cerrarProcesosDefinitivamente() {
  if (perfilesActivos.size > 0) {
    for (const [idStr, winPerfil] of perfilesActivos.entries()) {
      if (winPerfil) {
        try {
          if (!winPerfil.isDestroyed()) winPerfil.close();
        } catch (e) {}
      }
      perfilesActivos.delete(idStr);
    }
  }
}

app.on('before-quit', async (event) => {
  if (perfilesActivos.size > 0) {
    event.preventDefault();
    await cerrarProcesosDefinitivamente();
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  await cerrarProcesosDefinitivamente();
  if (process.platform !== 'darwin') app.quit();
});
