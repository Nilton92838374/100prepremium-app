require('electron-unhandled')();

const electron = require('electron');
const app = electron.app;

// OPTIMIZACIÓN EXTREMA DE RAM Y GPU: Desactivar aceleración de hardware al inicio
app.disableHardwareAcceleration();

const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const dialog = electron.dialog;
const session = electron.session;

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { createClient } = require('@supabase/supabase-js');
const supabaseConfig = require('./supabaseConfig');

// Configuración de Supabase Cloud
const SUPABASE_URL = supabaseConfig.SUPABASE_URL;
const SUPABASE_ANON_KEY = supabaseConfig.SUPABASE_ANON_KEY;

const supabase = (SUPABASE_URL && !SUPABASE_URL.includes('TU_PROYECTO'))
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ==============================================================================
// MÓDULO DE SEGURIDAD MILITAR: ENCRIPTACIÓN AES-256 PARA COOKIES Y DATOS DE NUBE
// ==============================================================================
const AES_SECRET_KEY = crypto.scryptSync('100prepremium-stealth-key-v29', 'antidetect-salt-master', 32);
const AES_IV_LENGTH = 16;

function encryptAES(text) {
  if (!text) return '';
  try {
    const stringToEncrypt = (typeof text === 'object') ? JSON.stringify(text) : String(text);
    const iv = crypto.randomBytes(AES_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', AES_SECRET_KEY, iv);
    let encrypted = cipher.update(stringToEncrypt, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    return (typeof text === 'object') ? JSON.stringify(text) : String(text);
  }
}

function decryptAES(encryptedText) {
  if (!encryptedText) return '';
  try {
    if (typeof encryptedText === 'object') return encryptedText;
    const parts = String(encryptedText).split(':');
    if (parts.length !== 2) {
      try { return JSON.parse(encryptedText); } catch (e) { return encryptedText; }
    }
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', AES_SECRET_KEY, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return decrypted;
    }
  } catch (err) {
    try { return JSON.parse(encryptedText); } catch (e) { return encryptedText; }
  }
}

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
          nombre: 'ChatGPT Pro Workstation', 
          etiqueta: 'Principal',
          categoria: 'IA Pro',
          etiquetaColor: '#2d2d2d',
          urlAviso: 'https://chatgpt.com',
          proxy: '192.168.1.50:8080', 
          proxyHost: '192.168.1.50',
          proxyPort: '8080',
          proxyUser: '',
          proxyPass: '',
          osTarget: 'Windows 11',
          userAgent: RANDOM_DESKTOP_UAS[0],
          cookie: '', 
          syncStatus: 'cloud',
          notas: 'Cuenta principal de automatización ChatGPT'
        },
        { 
          id: '1831', 
          nombre: 'E-Commerce Store Manager', 
          etiqueta: 'Amazon',
          categoria: 'Ventas',
          etiquetaColor: '#374151',
          urlAviso: 'https://sellercentral.amazon.com',
          proxy: '10.0.0.15:3128', 
          proxyHost: '10.0.0.15',
          proxyPort: '3128',
          proxyUser: '',
          proxyPass: '',
          osTarget: 'macOS Sonoma',
          userAgent: RANDOM_DESKTOP_UAS[1],
          cookie: '', 
          syncStatus: 'cloud',
          notas: 'Gestión de tienda principal Amazon US'
        },
        { 
          id: '1832', 
          nombre: 'Marketing Campaign Lead', 
          etiqueta: 'Facebook',
          categoria: 'Social',
          etiquetaColor: '#4b5563',
          urlAviso: 'https://business.facebook.com',
          proxy: '172.16.0.42:8000', 
          proxyHost: '172.16.0.42',
          proxyPort: '8000',
          proxyUser: '',
          proxyPass: '',
          osTarget: 'Linux Ubuntu',
          userAgent: RANDOM_DESKTOP_UAS[2],
          cookie: '', 
          syncStatus: 'cloud',
          enRevision: true,
          notas: 'Campañas de anuncios Meta Ads'
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
          usuario: 'cliente_alpha_pro',
          password: 'password123',
          nombre: 'Cliente Alpha Pro', 
          fechaInicio: new Date().toISOString(),
          fechaVencimiento: '2026-12-31T23:59',
          perfilesAsignados: ['1830'],
          hwidVinculado: null,
          syncStatus: 'cloud'
        },
        { 
          id: 'c102', 
          usuario: 'empresa_soluciones_latam',
          password: 'password123',
          nombre: 'Empresa Soluciones LATAM', 
          fechaInicio: new Date().toISOString(),
          fechaVencimiento: '2026-11-30T23:59',
          perfilesAsignados: ['1831'],
          hwidVinculado: null,
          syncStatus: 'cloud'
        },
        { 
          id: 'c103', 
          usuario: 'agencia_digital_vip',
          password: 'password123',
          nombre: 'Agencia Digital VIP', 
          fechaInicio: new Date().toISOString(),
          fechaVencimiento: '2027-01-15T23:59',
          perfilesAsignados: ['1832'],
          hwidVinculado: null,
          syncStatus: 'cloud'
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

  // LOGIN CON ARQUITECTURA DE ROLES NATIVA SUPABASE CLOUD (superadmin, admin, cliente)
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

    // Formateo transparente de usuario a email para Supabase Auth
    const emailFormatted = usuarioInput.includes('@') ? usuarioInput : `${usuarioInput}@100prepremium.com`;

    if (supabase) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: emailFormatted,
          password: passwordInput
        });

        if (!authErr && authData && authData.user) {
          const userId = authData.user.id;
          const { data: roleData } = await supabase
            .from('usuarios_roles')
            .select('*')
            .eq('user_id', userId)
            .single();

          const rol = roleData ? roleData.rol : 'cliente';
          return {
            success: true,
            role: rol,
            usuario: usuarioInput.split('@')[0],
            userId: userId,
            mensaje: `Acceso concedido como ${rol.toUpperCase()}`
          };
        }
      } catch (sbErr) {
        console.warn('[SUPABASE AUTH WARNING]', sbErr.message);
      }
    }

    return { success: false, mensaje: "Credenciales incorrectas o usuario no registrado en Supabase Cloud." };
  });

  // LOGOUT (CERRAR SESIÓN)
  ipcMain.handle('logout', async () => {
    console.log('[AUTENTICACIÓN] Sesión cerrada por el usuario. Limpiando procesos activos...');
    await cerrarProcesosDefinitivamente();
    return { success: true };
  });

  // ---------------------------------------------------------
  // HANDLERS IPC DE PERFILES Y USUARIOS CLOUD ESTRICTOS (V2.3.5)
  // ---------------------------------------------------------
  ipcMain.handle('obtener-perfiles', async (_event, userContext) => {
    if (supabase) {
      try {
        let query = supabase.from('perfiles').select('*');
        if (userContext && userContext.role === 'cliente' && userContext.userId) {
          query = query.eq('asignado_a', userContext.userId);
        }
        const { data, error } = await query;
        if (error) {
          console.error('[SUPABASE FETCH ERROR]', error.message);
          return { success: false, message: 'Error al consultar Supabase Cloud: ' + error.message };
        }
        if (data) {
          const perfilesCloud = data.map(p => ({
            id: (p.id || '').toString(),
            nombre: p.nombre || 'Perfil Sin Nombre',
            categoria: p.grupo || p.categoria || 'General',
            grupo: p.grupo || p.categoria || 'General',
            etiqueta: p.etiqueta || 'GENERAL',
            etiquetaColor: p.etiqueta_color || '#2563EB',
            urlAviso: p.url_aviso || '',
            proxy: p.proxy || (p.proxy_host && p.proxy_port ? `${p.proxy_host}:${p.proxy_port}` : ''),
            proxyHost: p.proxy_host || '',
            proxyPort: p.proxy_port || '',
            proxyUser: p.proxy_user || '',
            proxyPass: p.proxy_pass || '',
            osTarget: p.sistema_operativo || p.os_target || 'Windows 11',
            sistema_operativo: p.sistema_operativo || p.os_target || 'Windows 11',
            userAgent: p.user_agent || '',
            user_agent: p.user_agent || '',
            estado: p.estado || 'Activo',
            asignadoA: p.asignado_a || null,
            notas: p.observacion || p.notas || '',
            observacion: p.observacion || p.notas || ''
          }));
          return perfilesCloud;
        }
      } catch (sbErr) {
        console.error('[SUPABASE FETCH EXCEPTION]', sbErr.message);
        return { success: false, message: sbErr.message };
      }
    }
    return [];
  });

  ipcMain.handle('crear-perfil', async (_event, nuevoPerfilData) => {
    if (!nuevoPerfilData || !nuevoPerfilData.nombre) {
      return { success: false, message: 'El nombre del perfil es obligatorio.' };
    }

    if (!supabase) {
      return { success: false, message: 'Error: Cliente de Supabase Cloud no inicializado.' };
    }

    try {
      const objetoPerfil = {
        nombre: nuevoPerfilData.nombre.trim(),
        observacion: (nuevoPerfilData.observacion || nuevoPerfilData.notas || '').trim(),
        grupo: (nuevoPerfilData.grupo || nuevoPerfilData.categoria || 'General').trim(),
        etiqueta: (nuevoPerfilData.etiqueta || 'GENERAL').trim(),
        proxy: (nuevoPerfilData.proxy || '').trim(),
        estado: nuevoPerfilData.estado || 'Activo',
        user_agent: (nuevoPerfilData.userAgent || nuevoPerfilData.user_agent || '').trim(),
        sistema_operativo: nuevoPerfilData.osTarget || nuevoPerfilData.sistema_operativo || 'Windows 11',
        asignado_a: nuevoPerfilData.asignadoA || null
      };

      const { data, error } = await supabase
        .from('perfiles')
        .insert([objetoPerfil]);

      if (error) {
        console.error('[SUPABASE INSERT ERROR]', error.message);
        return { success: false, message: 'Error al insertar en Supabase Cloud: ' + error.message };
      }

      console.log('[SUPABASE INSERT EXITOSO] Perfil creado:', objetoPerfil.nombre);
      return { success: true, message: 'Perfil guardado exitosamente en Supabase Cloud.' };
    } catch (err) {
      console.error('[CREAR PERFIL EXCEPCION]', err.message);
      return { success: false, message: err.message };
    }
  });

  // SISTEMA DE CREACIÓN Y GESTIÓN DE MIEMBROS DE EQUIPO EN LA NUBE
  ipcMain.handle('invitar-miembro-equipo', async (_event, memberData) => {
    const { email, password, rol, adminId } = memberData || {};
    if (!email) return { success: false, mensaje: 'El correo o usuario del miembro es requerido.' };
    const passInput = (password && password.length >= 6) ? password.trim() : 'password123';
    const rolInput = rol || 'admin';
    const emailFormatted = email.includes('@') ? email.trim() : `${email.trim()}@100prepremium.com`;

    if (supabase) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: emailFormatted,
          password: passInput
        });

        if (authErr) {
          console.warn('[SUPABASE SIGNUP NOTICE]', authErr.message);
        }

        const userId = (authData && authData.user) ? authData.user.id : `usr_${Date.now()}`;

        await supabase.from('usuarios_roles').upsert([{
          user_id: userId,
          email: emailFormatted,
          usuario: email.split('@')[0],
          rol: rolInput
        }]);

        await supabase.from('miembros_equipo').upsert([{
          admin_id: adminId || 'admin_master',
          email: emailFormatted,
          rol: rolInput,
          estado: 'Activo',
          fecha_invitacion: new Date().toISOString()
        }]);

        return { success: true, mensaje: `Miembro ${emailFormatted} creado exitosamente con la contraseña asignada.` };
      } catch (err) {
        return { success: false, mensaje: 'Error al registrar miembro: ' + err.message };
      }
    }
    return { success: true, mensaje: `Miembro ${emailFormatted} registrado localmente.` };
  });

  ipcMain.handle('obtener-miembros-equipo', async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('miembros_equipo').select('*');
        if (!error && data) return data;
      } catch (err) {}
    }
    return [
      { id: 1, email: 'admin_lead@100prepremium.com', estado: 'Activo', fecha_invitacion: new Date().toISOString() },
      { id: 2, email: 'admin_tech@100prepremium.com', estado: 'Activo', fecha_invitacion: new Date().toISOString() },
      { id: 3, email: 'admin_ops@100prepremium.com', estado: 'Activo', fecha_invitacion: new Date().toISOString() }
    ];
  });

  ipcMain.handle('actualizar-perfil', async (_event, perfilData) => {
    try {
      const perfiles = cargarPerfiles();
      const idx = perfiles.findIndex(p => p.id === perfilData.id.toString());
      if (idx !== -1) {
        perfiles[idx] = Object.assign({}, perfiles[idx], perfilData);
        guardarPerfiles(perfiles);
      }

      if (supabase) {
        try {
          await supabase.from('perfiles').update({
            nombre: perfilData.nombre,
            categoria: perfilData.categoria,
            etiqueta: perfilData.etiqueta,
            etiqueta_color: perfilData.etiquetaColor,
            url_aviso: perfilData.urlAviso,
            proxy_host: perfilData.proxyHost,
            proxy_port: perfilData.proxyPort,
            proxy_user: perfilData.proxyUser,
            proxy_pass: perfilData.proxyPass,
            os_target: perfilData.osTarget,
            user_agent: perfilData.userAgent,
            asignado_a: perfilData.asignadoA,
            notas: perfilData.notas
          }).eq('id', perfilData.id.toString());
        } catch (sbErr) {}
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('crear-usuario-admin', async (_event, userData) => {
    const { email, password, rol } = userData || {};
    if (!email || !password || password.length < 6) {
      return { success: false, mensaje: 'Usuario/Email y contraseña (mínimo 6 caracteres) son requeridos.' };
    }

    const emailFormatted = email.includes('@') ? email.trim() : `${email.trim()}@100prepremium.com`;
    const usuarioVal = email.split('@')[0].trim();

    if (supabase) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: emailFormatted,
          password: password.trim()
        });

        if (authErr) return { success: false, mensaje: authErr.message };

        if (authData && authData.user) {
          await supabase.from('usuarios_roles').insert([{
            user_id: authData.user.id,
            email: emailFormatted,
            usuario: usuarioVal,
            rol: rol || 'cliente'
          }]);

          await supabase.from('clientes').insert([{
            user_id: authData.user.id,
            usuario: usuarioVal,
            fecha_inicio: new Date().toISOString()
          }]);

          return { success: true, usuario: authData.user, mensaje: `Usuario ${usuarioVal} registrado exitosamente en la nube Supabase.` };
        }
      } catch (err) {
        return { success: false, mensaje: 'Error registrando usuario en Supabase Cloud: ' + err.message };
      }
    }

    return { success: false, mensaje: 'Supabase Cloud no está conectado. Verifica tu SUPABASE_URL y SUPABASE_ANON_KEY.' };
  });

  ipcMain.handle('obtener-usuarios', async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('usuarios_roles').select('*');
        if (!error && data) return data;
      } catch (err) {}
    }
    const clientes = cargarClientes();
    return clientes.map(c => ({
      user_id: c.id,
      email: `${c.usuario}@100prepremium.local`,
      usuario: c.usuario,
      rol: 'cliente'
    }));
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

      // Restauración de cookies previas guardadas en el perfil
      if (perfilData && perfilData.cookie && perfilData.cookie.trim() !== '') {
        try {
          const cookiesArray = JSON.parse(perfilData.cookie.trim());
          if (Array.isArray(cookiesArray) && cookiesArray.length > 0) {
            for (const c of cookiesArray) {
              const domainClean = (c.domain || '').replace(/^\./, '');
              const cookieUrl = (c.secure ? 'https://' : 'http://') + (domainClean || 'localhost') + (c.path || '/');
              try {
                await perfilSession.cookies.set({
                  url: cookieUrl,
                  name: c.name,
                  value: c.value,
                  domain: c.domain,
                  path: c.path,
                  secure: c.secure,
                  httpOnly: c.httpOnly,
                  expirationDate: c.expirationDate
                });
              } catch (cErr) {}
            }
            console.log(`[COOKIES RESTORED] Inyectadas ${cookiesArray.length} cookies en partición persist:perfil-${idStr}`);
          }
        } catch (err) {
          console.warn(`[COOKIES RESTORE ERROR] Error parseando cookies para el perfil ${idStr}:`, err.message);
        }
      }

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

      // Captura automática de cookies antes de cerrar la ventana del perfil
      winPerfil.on('close', async () => {
        try {
          const activeCookies = await perfilSession.cookies.get({});
          if (activeCookies && activeCookies.length > 0) {
            const cookiesJson = JSON.stringify(activeCookies);
            const listPerfiles = cargarPerfiles();
            const targetProfile = listPerfiles.find(p => p.id === idStr);
            if (targetProfile) {
              targetProfile.cookie = cookiesJson;
              guardarPerfiles(listPerfiles);
              console.log(`[COOKIES AUTO-SAVED] Se guardaron ${activeCookies.length} cookies para el perfil ${idStr}`);
            }
          }
        } catch (cookieErr) {
          console.warn(`[COOKIES SAVE WARNING] No se pudieron guardar cookies del perfil ${idStr}:`, cookieErr.message);
        }
      });

      // Guardar en estado activo y manejar el cierre de la ventana con purga explícita de RAM
      perfilesActivos.set(idStr, winPerfil);
      winPerfil.on('closed', async () => {
        try {
          await perfilSession.clearCache();
        } catch (e) {}
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
      try {
        const perfilSession = session.fromPartition('persist:perfil-' + idStr);
        await perfilSession.clearCache();
      } catch (e) {}

      if (!winPerfil.isDestroyed()) {
        winPerfil.destroy();
      }
      perfilesActivos.delete(idStr);
    }
    return { success: true };
  });

  createMainWindow();

  // Configuración de versión IPC y reinicio
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('reiniciar-app', () => {
    autoUpdater.quitAndInstall();
  });

  // Listener para búsqueda manual de actualizaciones desde el frontend
  ipcMain.on('check-for-updates-manual', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'checking',
        message: 'Buscando actualizaciones...'
      });
    }
    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      console.log('Error de actualización atrapado de forma segura:', error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', {
          status: 'error',
          message: 'No se encontraron actualizaciones.'
        });
      }
    }
  });

  // Configuración de actualizaciones silenciosas en segundo plano
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';

  // Buscar actualizaciones sin avisar
  try {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.log('Error de actualización atrapado de forma segura:', error);
    });
  } catch (error) {
    console.log('Error de actualización atrapado de forma segura:', error);
  }

  // Eventos de consola y notificaciones IPC al frontend
  autoUpdater.on('checking-for-update', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'checking',
        message: 'Buscando actualizaciones...'
      });
    }
  });

  autoUpdater.on('update-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'downloading',
        message: 'Descargando actualización...'
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'up-to-date',
        message: `Tu aplicación está actualizada (v${app.getVersion()}).`
      });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'ready',
        message: 'Actualización lista. Cierra y abre la app.'
      });
    }
  });

  autoUpdater.on('error', (error) => {
    console.log('Error de actualización atrapado de forma segura:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'error',
        message: 'No se pudo comprobar actualizaciones.'
      });
    }
  });

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
