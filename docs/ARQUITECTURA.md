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
    |  - CRUD productos, ofertas, configs, monitores            |
    |  - Endpoint de analisis HTML (con proteccion SSRF)        |
    |  - Centro de notificaciones                               |
    +------+--------------------------------+-------------------+
           |                                |
           v                                v
    +------------------+         +-----------------------------+
    |  MySQL 8.0       |<--------|   SCRAPER WORKER (Node)     |
    |  (Docker 3307)   |         |  - Playwright + Cheerio     |
    |                  |         |  - BullMQ (cola Redis)      |
    |  - users         |         |  - Cron programado          |
    |  - products      |         |  - Compara precios          |
    |  - offers        |         +--------------+--------------+
    |  - configs       |                        |
    |  - monitors      |                        v
    |  - historial     |              +---------------------+
    |  - ejecuciones   |              |   Redis 7 (Docker)  |
    |  - alertas       |              |   BullMQ            |
    +------------------+              +---------------------+

## Decisiones tecnicas

### Worker separado del API
El scraping con Playwright consume mucha memoria (Chromium ~300MB por
instancia). Aislarlo evita bloquear el API y permite escalar workers
independientemente.

### Redis + BullMQ para programacion
Los cron nativos de Node (node-cron) se pierden al reiniciar el servidor.
BullMQ persiste los jobs en Redis y usa repeatable jobs que sobreviven
reinicios. Es la solucion fiable.

### Playwright + Cheerio
Primero se intenta fetch + Cheerio (rapido, ligero). Si la pagina requiere
JavaScript, se cae a Playwright.

### Prisma ORM
Tipado fuerte end-to-end con TypeScript, migraciones versionadas, evita SQL
manual propenso a errores.

### JWT + refresh token
Access token corto (15 min) + refresh token httpOnly. Estandar para SPAs.

### MySQL en Docker en puerto 3307
Aislado del MySQL nativo del usuario (puerto 3306) para no mezclar datos
ni provocar conflictos.

### Separacion Product / Offer / Monitor
Tres entidades distintas con responsabilidades claras:

- Product: entidad canonica del producto (nombre, imagen, dominio,
  canonicalUrl). Es unico en la base de datos. Se comparte entre usuarios.

- Offer: publicacion de un producto por un usuario (precio, precio
  anterior, URL de la oferta, quien la publico, fecha). Un producto
  puede tener varias ofertas de distintos usuarios.

- Monitor: seguimiento de un producto por un usuario (frecuencia,
  alertas, estado, precio actual). Un producto puede ser monitoreado
  por varios usuarios. Cada monitor tiene su propia config de scraping.

Ventajas:
- Evita duplicar producto cuando varios usuarios publican la misma oferta.
- Permite que varios usuarios monitoreen el mismo producto sin duplicar.
- Cambios en el producto (imagen, nombre) se reflejan en todas sus ofertas
  y monitores.

Estrategia de identificacion de producto:
- Normalizar URL: quitar query string, hash, trailing slash.
- Guardar canonicalUrl en Product con indice unico.
- Al crear Offer o Monitor: normalizar URL, buscar Product existente,
  reutilizar o crear nuevo.
- Limitacion: la normalizacion basica no cubre todos los sitios. Se
  puede mejorar con reglas por dominio mas adelante.

### Ofertas como modulo principal
La home (/) muestra el feed publico de ofertas. El dashboard privado del
usuario vive en /dashboard. La comunidad es la puerta de entrada al
producto, no una seccion secundaria.

### Sin comentarios ni votos
Decidido no implementar Comment ni Vote en esta version del proyecto.
Schema mas simple.

## Esquema de base de datos (resumen)

9 tablas:

- users                -> cuentas de usuario
- products             -> entidad canonica de producto
- offers               -> publicaciones de productos (modulo principal)
- scrape_configs       -> configuraciones de scraping (una por URL/patron)
- scrape_fields        -> campos/selectores por config
- monitors             -> seguimiento de producto por usuario
- scrape_runs          -> auditoria de cada ejecucion
- price_history        -> historico de precios (append-only)
- notifications        -> alertas generadas

Detalle completo en apps/api/prisma/schema.prisma.

## Identidad visual

Paleta oficial:

| Uso                  | Color           |
|----------------------|-----------------|
| Primario             | Azul profundo   |
| Secundario           | Azul medio      |
| Acento               | Azul claro      |
| Fondos               | Blanco / gris muy claro |
| Texto secundario     | Gris plata      |
| Exito / bajada       | Verde           |
| Error / subida       | Rojo            |
| Advertencia          | Amarillo        |

Reglas:
- Tipografia legible con jerarquia clara.
- Bordes ligeramente redondeados.
- Sombras suaves.
- Sin gradientes exagerados, sin neones, sin efectos de cristal.
- Sin animaciones decorativas excesivas.
- Responsive con prioridad en escritorio.

Se aplicara en FASE 6 (estructura visual).

## Riesgos tecnicos del scraping configurable

- SSRF: validar URL, bloquear IPs privadas, localhost, metadata endpoints,
  controlar redirects.
- Contenido dinamico: fallback a Playwright.
- Anti-bot: NO evadir. Detectar y reportar al usuario.
- Cambios de estructura HTML: guardar snapshot crudo en scrape_runs.
- Precios ambiguos: mostrar cuantos elementos coinciden.
- Precios en formato local (1.234,56 EUR): parser configurable.
- Ejecuciones simultaneas: lock en Redis por monitor_id.
- Fallo del scheduler al reiniciar: BullMQ repeatable jobs persisten.

## Seguridad

- Validacion de URL contra SSRF.
- No exponer credenciales ni cookies.
- No evadir CAPTCHAs ni autenticaciones.
- Respetar terminos de uso.
- No renderizar HTML de terceros sin sanitizacion.
- Hash de contrasenas con bcrypt.
- JWT con expiracion corta.
- Autorizacion en backend (no solo ocultar en frontend).
