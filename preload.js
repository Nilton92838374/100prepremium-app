const electron = require('electron');
const contextBridge = electron.contextBridge;
const ipcRenderer = electron.ipcRenderer;

// Exposición segura de API al proceso de renderizado (Frontend) - 100prepremium v2.0
contextBridge.exposeInMainWorld('api', {
  getHwid: () => ipcRenderer.invoke('get-hwid'),
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  obtenerPerfiles: () => ipcRenderer.invoke('obtener-perfiles'),
  crearPerfil: (data) => ipcRenderer.invoke('crear-perfil', data),
  clonarPerfil: (idOriginal) => ipcRenderer.invoke('clonar-perfil', idOriginal),
  exportarPerfil: (idPerfil) => ipcRenderer.invoke('exportar-perfil', idPerfil),
  eliminarPerfil: (idPerfil) => ipcRenderer.invoke('eliminar-perfil', idPerfil),
  abrirPerfil: (idPerfil) => ipcRenderer.invoke('abrir-perfil', idPerfil),
  cerrarPerfil: (idPerfil) => ipcRenderer.invoke('cerrar-perfil', idPerfil),
  verificarProxy: (proxyUrl) => ipcRenderer.invoke('verificar-proxy', proxyUrl),
  capturarCookiesManual: (url) => ipcRenderer.invoke('capturar-cookies-manual', url),
  obtenerClientes: () => ipcRenderer.invoke('obtener-clientes'),
  crearCliente: (data) => ipcRenderer.invoke('crear-cliente', data),
  eliminarCliente: (idCliente) => ipcRenderer.invoke('eliminar-cliente', idCliente),
  desvincularHwidCliente: (idCliente) => ipcRenderer.invoke('desvincular-hwid-cliente', idCliente),
  logout: () => ipcRenderer.invoke('logout'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  reiniciarApp: () => ipcRenderer.invoke('reiniciar-app'),
  onPerfilActualizado: (callback) => ipcRenderer.on('perfil-actualizado', (_event, data) => callback(data)),
  onLogMessage: (callback) => ipcRenderer.on('log-message', (_event, data) => callback(data)),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, data) => callback(data))
});
