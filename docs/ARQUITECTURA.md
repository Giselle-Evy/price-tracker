# Arquitectura — Price Tracker

## Diagrama general

    +-----------------------------------------------------------+
    |                    CLIENTE (Navegador)                    |
    |   React + TypeScript + Vite + Tailwind + Recharts         |
    +-----------------------------+-----------------------------+
                                  | HTTPS / REST + JWT
                                  v
    +-----------------------------------------------------------+
    |                  API BACKEND (Node + Express)             |
    |  - Auth JWT                                               |
    |  - CRUD configs, monitores, ofertas                       |
    |  - Endpoint de análisis HTML (con proteccion SSRF)        |
    |  - Centro de notificaciones                               |
    +------+--------------------------------+-------------------+
           |                                |
           v                                v
    +------------------+         +-----------------------------+
    |  MySQL 8.0       |<--------|   SCRAPER WORKER (Node)     |
    |  (Docker 3307)   |         |  - Playwright + Cheerio     |
    |                  |         |  - BullMQ (cola Redis)      |
    |  - usuarios      |         |  - Cron programado          |
    |  - configs       |         |  - Compara precios          |
    |  - monitores     |         +--------------+--------------+
    |  - historial     |                        |
    |  - ejecuciones   |                        v
    |  - alertas       |              +---------------------+
    |  - ofertas       |              |   Redis 7 (Docker)  |
    +------------------+              |   BullMQ            |
                                      +---------------------+

## Decisiones técnicas

### Worker separado del API
El scraping con Playwright consume mucha memoria (Chromium ~300MB por
instancia). Aislarlo evita bloquear el API y permite escalar workers
independientemente.

### Redis + BullMQ para programación
Los cron nativos de Node (node-cron) se pierden al reiniciar el servidor.
BullMQ persiste los jobs en Redis y usa repeatable jobs que sobreviven
reinicios. Es la solución fiable.

### Playwright + Cheerio
Primero se intenta fetch + Cheerio (rápido, ligero). Si la página requiere
JavaScript, se cae a Playwright.

### Prisma ORM
Tipado fuerte end-to-end con TypeScript, migraciones versionadas, evita SQL
manual propenso a errores.

### JWT + refresh token
Access token corto (15 min) + refresh token httpOnly. Estándar para SPAs.

### MySQL en Docker en puerto 3307
Aislado del MySQL nativo del usuario (puerto 3306) para no mezclar datos
ni provocar conflictos.

## Esquema de base de datos (resumen)

Tablas:
- users                → cuentas de usuario
- scrape_configs       → configuraciones de scraping (una por URL/patrón)
- scrape_fields        → campos/selectores por config
- monitors             → productos monitoreados
- scrape_runs          → auditoría de cada ejecución
- price_history        → histórico de precios (append-only)
- notifications        → alertas generadas
- offers               → módulo comunitario de ofertas

Detalle completo en apps/api/prisma/schema.prisma (se creará en Fase 1).

## Riesgos técnicos del scraping configurable

- SSRF: validar URL, bloquear IPs privadas, localhost, metadata endpoints,
  controlar redirects.
- Contenido dinámico: fallback a Playwright.
- Anti-bot: NO evadir. Detectar y reportar al usuario.
- Cambios de estructura HTML: guardar snapshot crudo en scrape_runs.
- Precios ambiguos: mostrar cuántos elementos coinciden.
- Precios en formato local (1.234,56 €): parser configurable.
- Ejecuciones simultáneas: lock en Redis por monitor_id.
- Fallo del scheduler al reiniciar: BullMQ repeatable jobs persisten.

## Seguridad

- Validación de URL contra SSRF.
- No exponer credenciales ni cookies.
- No evadir CAPTCHAs ni autenticaciones.
- Respetar términos de uso.
