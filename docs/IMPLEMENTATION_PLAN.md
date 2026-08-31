# IMPLEMENTATION PLAN - 100prepremium v2.3.3

Estrategia de arquitectura, control de cambios y plan de rollback para la versión **v2.3.3**.

---

## 1. Priorización de Soluciones

### P0 (Crítico - Bloqueante)
1. **Sincronización Estricta Nube**: Eliminar lecturas/escrituras en archivos locales desfasados en `main.js`. Consultar únicamente Supabase Cloud.
2. **Creación de Miembros**: Implementación de formulario directo en la pestaña Miembros con Usuario, Contraseña y Rol persistidos en la nube.
3. **Navegación e Interacción UI**: Remoción de bloqueos `.admin-only` en el CSS para permitir clics e interacción fluida en todas las pestañas.

### P1 (Alto - Funcional)
1. **Acciones de Tabla de Perfiles**:
   - `Abrir`: Lanzar instancia Puppeteer/Chrome aislada.
   - `Clonar`: Duplicar datos en la nube con nuevo ID generado.
   - `Exportar`: Generación de archivo JSON seguro.
   - `Eliminar`: Confirmación y borrado atómico en la nube.
2. **Importación Masiva de Proxies**: Formato `IP:Puerto:Usuario:Pass` procesado e inyectado en tabla.
3. **Copiado de HWID**: Integración con `navigator.clipboard.writeText` y alerta de confirmación.

### P2 (Medio - Calidad & UX)
1. **Paleta de Colores SaaS Sobria**: Aplicación estricta de `#0D1117`, `#101722`, `#151D29`, `#121A25`, `#273244`, `#2563EB`, `#0891B2`, `#22C55E`, `#EF4444`.
2. **Microinteracciones Ligera**: Transiciones CSS restringidas a `120ms` sin uso de canvas, partículas ni blur pesado.

---

## 2. Estrategia de Rollback
En caso de fallo en la versión distribuida:
- Mantener las migraciones compatibles en la base de datos de Supabase.
- Re-desplegar la etiqueta anterior mediante la compilación del paquete ejecutable NSIS desde Git.
