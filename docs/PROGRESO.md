# Progreso del Proyecto — Price Tracker

Historial de fases completadas. Numeración adoptada del Prompt Maestro
(`docs/PROMPT_MAESTRO.md`), que organiza el proyecto en 20 fases (0 a 19/20).

---

## Equivalencia con el trabajo previo

Antes de adoptar la numeración del prompt maestro, llamábamos "Fase 0" y
"Fase 1" a algunos hitos. La correspondencia es:

| Lo que hicimos                          | Fase del prompt maestro        | Estado |
|-----------------------------------------|--------------------------------|--------|
| Preparar entorno (Node, pnpm, Docker)   | FASE 0 + parte de FASE 3       | OK     |
| Crear repo, monorepo, docs              | FASE 2 + FASE 3                | OK     |
| Scaffold de apps/api                    | FASE 2                         | OK     |
| Inicializar Prisma y conexión MySQL     | FASE 4 (parcial)               | OK     |
| Schema Prisma completo                  | FASE 4 (siguiente)             | Pend.  |

A partir de aquí, usamos la numeración del prompt maestro.

---

## FASE 0 — Revisar entorno de desarrollo

**Estado:** COMPLETADA
**Fecha:** 08/10/2026

### Objetivo
Verificar que todas las herramientas necesarias están instaladas y funcionando.

### Resultado
- Node.js v22.14.0
- pnpm 12.10.1 (instalado durante esta fase)
- Git 2.49.0
- Docker Desktop
- VS Code 1.140.0
- Cuentas: GitHub

---

## FASE 1 — Definir arquitectura y alcance técnico

**Estado:** COMPLETADA
**Fecha:** 08/10/2026

### Objetivo
Documentar stack, arquitectura y decisiones.

### Resultado
- `docs/ARQUITECTURA.md` creado.
- `docs/CONTEXTO.md` creado.
- Stack elegido: React + Node + Express + TypeScript + Prisma + MySQL +
  Redis + BullMQ + Playwright.

---

## FASE 2 — Estructura de carpetas y scaffolds

**Estado:** COMPLETADA
**Fecha:** 08/10/2026

### Objetivo
Crear el monorepo con pnpm workspaces y el scaffold del backend.

### Resultado
- Estructura `apps/` (web, api, worker) y `packages/` (shared).
- `pnpm-workspace.yaml` configurado.
- `package.json` raíz con scripts globales.
- `apps/api` con:
  - `package.json` (deps: express, prisma, zod, bcrypt, jwt, helmet, cors).
  - `tsconfig.json` (strict, ESM, target ES2022).
  - `.gitignore` local.
  - Estructura `src/` (config, lib, middleware, modules, services).
  - `src/index.ts` placeholder.
- `pnpm install` ejecutado (207 paquetes).
- `pnpm approve-builds` aprobado para Prisma, bcrypt, esbuild.

### Incidentes resueltos
- `package.json` con BOM UTF-8 rompía `tsx`. Se reescribió sin BOM.
- `tsconfig.json`, `.gitignore`, `src/index.ts` también tenían BOM. Limpiados.
- Lección: archivos `.json`, `.ts`, `.yaml`, `.prisma` → SIEMPRE desde VS Code.

---

## FASE 3 — Git, GitHub, Docker, variables de entorno

**Estado:** COMPLETADA
**Fecha:** 08/10/2026

### Objetivo
Dejar el proyecto versionado, con Docker y variables de entorno.

### Resultado
- Repo `https://github.com/Giselle-Evy/price-tracker` (público).
- `.gitignore` raíz con node_modules, dist, .env, logs, cache.
- `.env.example` con todas las variables documentadas.
- `.env` real (ignorado por Git).
- `docker-compose.yml` con:
  - `price-tracker-mysql` (MySQL 8.0, puerto 3307).
  - `price-tracker-redis` (Redis 7, puerto 6380).
  - Volúmenes propios.
  - Healthchecks.
- MySQL healthy, base `price_tracker` creada.
- Redis healthy, responde PONG.

### Incidentes resueltos
- `mysql:8` descargó 8.4, que ya no acepta `--default-authentication-plugin`.
  Solución: fijar a `mysql:8.0` y quitar el flag.

### Commits relevantes
- `39629ae` chore: initial project structure
- `59f0f9e` fix(docker): pin mysql to 8.0 and remove deprecated auth plugin flag
- `f608ae2` docs: add project context, progress and architecture documentation
- `c583aaf` feat(api): scaffold backend with TypeScript, Express deps and Prisma client
- `d4a6718` feat(api): initialize Prisma with datasource config

---

## FASE 4 — Base de datos y primeras migraciones

**Estado:** EN CURSO
**Fecha inicio:** 08/10/2026

### Objetivo
Diseñar y crear todas las tablas del sistema en MySQL, con sus relaciones.

### Lo hecho hasta ahora
- `apps/api/prisma/schema.prisma` inicializado con `generator` y `datasource`.
- `apps/api/.env` copiado para que Prisma lo lea.
- Conexión a MySQL verificada con `SELECT 1`.
- Decisiones tomadas:
  - Ofertas = módulo principal (home = feed de ofertas).
  - Separar `Product` + `Offer` + `Monitor`.
  - Sin `Comment` ni `Vote`.
  - Nombre del proyecto se mantiene `price-tracker`.

### Pendiente
- Escribir el schema completo con 9 tablas:
  - User, Product, Offer, ScrapeConfig, ScrapeField, Monitor,
    ScrapeRun, PriceHistory, Notification.
- Ejecutar `prisma migrate dev --name init`.
- Ejecutar `prisma generate`.
- Verificar con Prisma Studio.
- Commit y push.

---

## FASE 5 y siguientes — Pendientes

(Fases 5 a 20 según el Prompt Maestro. Se irán documentando al completarse.)
