# MATRIZ FUNCIONAL - 100prepremium v2.3.3

Matriz de auditoría de todos los elementos interactivos del sistema, su canal IPC/servicio y su estado final de verificación.

| Pantalla | Elemento / Acción | Handler IPC / Evento | Persistencia | Estado Inicial | Estado Final | Prioridad |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Login** | Botón "Iniciar Sesión" | `login` | Supabase Auth Cloud | Parcial | **Funcional (P0)** | P0 |
| **Header** | Botón "Buscar Actualizaciones" | `get-app-version` | Respuesta de Versión | Incompleto | **Funcional (P1)** | P1 |
| **Header** | Botón "Cerrar Sesión" | `logout` | Purga Procesos/Sesión | Incompleto | **Funcional (P0)** | P0 |
| **Header** | Badge "Acceso Total Licenciado" | Estado de Rol | Memoria / Cloud | Estático | **Funcional (P2)** | P2 |
| **Sidebar** | HWID "Copiar HWID" | `get-hwid` | Portapapeles Nativo | Incompleto | **Funcional (P1)** | P1 |
| **Sidebar** | Pestañas (Perfiles, Grupos, Proxies, Miembros, Registros, Config) | `cambiarPestana()` | UI State | Bloqueado | **Funcional (P0)** | P0 |
| **Perfiles** | Botón "+ Crear Perfil" | `crear-perfil` | Supabase `perfiles` | Parcial | **Funcional (P0)** | P0 |
| **Perfiles** | Botón "Abrir" | `abrir-perfil` | Puppeteer / Chrome | Parcial | **Funcional (P0)** | P0 |
| **Perfiles** | Botón "Clonar" | `clonar-perfil` | Supabase `perfiles` | Incompleto | **Funcional (P1)** | P1 |
| **Perfiles** | Botón "Exportar" | `exportar-perfil` | Sistema de Archivos JSON | Incompleto | **Funcional (P1)** | P1 |
| **Perfiles** | Botón "Eliminar" | `eliminar-perfil` | Supabase `perfiles` | Parcial | **Funcional (P0)** | P0 |
| **Proxies** | Botón "+ Importación Masiva" | `form-import-proxies` | Memoria / Tabla Proxies | No implementado | **Funcional (P1)** | P1 |
| **Miembros** | Formulario "+ Crear miembro" (User/Pass/Rol) | `invitar-miembro-equipo` | Supabase Auth + `miembros_equipo` | Incompleto / Roto | **Funcional (P0)** | P0 |
| **Miembros** | Tabla Miembros Registrados | `obtener-miembros-equipo` | Supabase `miembros_equipo` | Incompleto | **Funcional (P1)** | P1 |
| **Grupos** | Botón "+ Crear grupo" | `form-nuevo-grupo` | UI / Tabla Grupos | Incompleto | **Funcional (P2)** | P2 |
