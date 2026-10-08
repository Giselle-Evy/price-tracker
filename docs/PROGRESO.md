# Progreso del Proyecto — Price Tracker

Historial de fases completadas. Al final de cada fase se añade una sección.

---

## FASE 0 — Configuración del entorno

**Estado:** COMPLETADA
**Fecha:** 08/10/2026

### Objetivo
Dejar el entorno listo: herramientas instaladas, repo en GitHub, estructura
base del monorepo creada, MySQL y Redis corriendo en Docker.

### Qué se hizo

1. Verificación del entorno: Node v22.14.0, Git 2.49.0, VS Code 1.140.0 ya
   instalados. Se instaló pnpm 12.10.1 (faltaba).
2. Creación del repositorio en GitHub: https://github.com/Giselle-Evy/price-tracker
   (público, vacío).
3. Clonado local en C:\Users\evely\projects\price-tracker
4. Creación de la estructura monorepo:
   - apps/web, apps/api, apps/worker
   - packages/shared
5. Creación de archivos raíz:
   - pnpm-workspace.yaml
   - package.json (raíz, con scripts globales)
   - .gitignore
   - .env.example
   - docker-compose.yml
   - README.md
6. Levantado de MySQL 8.0 en Docker (puerto 3307) y Redis 7 (puerto 6380).
7. Creación del archivo .env real copiando .env.example.
8. Dos commits pusheados a GitHub:
   - chore: initial project structure
   - fix(docker): pin mysql to 8.0 and remove deprecated auth plugin flag

### Decisiones tomadas

- Monorepo con pnpm workspaces (no front/back separados).
- MySQL en Docker en puerto 3307, aislado del MySQL nativo (3306).
- Redis en Docker en puerto 6380.
- Imagen fijada a mysql:8.0 (no mysql:8, que ahora descarga 8.4 con breaking changes).
- Volúmenes Docker propios: price_tracker_mysql_data, price_tracker_redis_data.

### Estado del entorno al cerrar la fase

- price-tracker-mysql → Up (healthy) en 0.0.0.0:3307->3306/tcp
- price-tracker-redis → Up (healthy) en 0.0.0.0:6380->6379/tcp
- Base de datos price_tracker creada y verificada con SHOW DATABASES.
- Redis responde PONG.
- Contenedores antiguos del usuario (Nova-db, metabase, backend-container,
  frontend-container) intactos y apagados.

### Incidentes resueltos

1. La imagen mysql:8 descargó MySQL 8.4.11, que ya no acepta el flag
   --default-authentication-plugin=mysql_native_password. El contenedor
   entraba en bucle de reinicio.
   Solución: fijar imagen a mysql:8.0 y quitar el flag del command.

### Próximos pasos (Fase 1)

- Configurar apps/api con package.json, tsconfig.json, dependencias.
- Inicializar Prisma y escribir el schema completo (8 tablas).
- Ejecutar la primera migración.
- Verificar con Prisma Studio.
