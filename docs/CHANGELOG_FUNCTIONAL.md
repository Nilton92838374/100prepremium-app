# CHANGELOG FUNCTIONAL - 100prepremium v2.3.3

## [2.3.3] - 2026-08-30

### Corregido
- **Navegación en el Sidebar**: Eliminada la restricción de clase CSS `.admin-only` que impedía hacer clic e interactuar con las pestañas de Miembros, Proxies y Grupos.
- **Creación de Miembros de Equipo**: Reemplazado el sistema de invitación pasiva por un formulario completo donde el administrador asigna directamente **Usuario/Correo**, **Contraseña** y **Rol** (Admin/Superadmin/Cliente) persistidos en Supabase Auth y la nube.
- **Sincronización Multicuenta**: Erradicada la lectura/escritura en archivos locales viejos (`perfiles.json`), obligando al sistema a consultar y sincronizar directamente con Supabase Cloud.

### Añadido / Mejorado
- **Rediseño Visual SaaS Premium Sobrio**:
  - Paleta exacta aplicable: `#0D1117` (Fondo principal), `#101722` (Sidebar), `#0F1620` (Header), `#151D29` (Paneles), `#121A25` (Filas de Tabla), `#273244` (Bordes), `#2563EB` (Primario), `#0891B2` (Secundario/Exportar), `#22C55E` (Activo), `#EF4444` (Borde rojo eliminar).
- **Acciones de Tabla de Perfiles**:
  - `Abrir` en azul primario `#2563EB`.
  - `Clonar` en gris oscuro `#273244`.
  - `Exportar` en turquesa `#0891B2`.
  - `Eliminar` en borde transparente con texto rojo `#EF4444`.
- **Feedback de Copiado HWID**: Notificación inmediata al copiar el identificador de hardware al portapapeles.
