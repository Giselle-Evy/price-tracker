# Contexto del Proyecto — Price Tracker

## ¿Qué es?

Plataforma web de web scraping configurable, monitoreo automático e historial
de precios. El usuario introduce una URL, inspecciona el HTML visualmente,
selecciona los elementos a extraer (nombre, precio, imagen, etc.), guarda la
configuración, y la convierte en un monitor que se ejecuta automáticamente
cada 5, 15 o 30 minutos. Los precios se guardan en histórico y se visualizan
en gráficas tipo Keepa.

## Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS + TanStack Query + Recharts
- **Backend**: Node.js + Express + TypeScript + Prisma + Zod
- **Base de datos**: MySQL 8.0 (en Docker, puerto 3307)
- **Cola de tareas**: Redis 7 + BullMQ (en Docker, puerto 6380)
- **Scraping**: Playwright + Cheerio
- **Contenedores**: Docker + Docker Compose
- **Auth**: JWT + bcrypt
- **Deploy previsto**: Vercel (frontend) + Railway (API, worker, Redis, MySQL)

## Arquitectura

Monorepo con pnpm workspaces:

- apps/web      → Frontend React
- apps/api      → Backend Express
- apps/worker   → Proceso de scraping programado (BullMQ)
- packages/shared → Tipos y validaciones Zod compartidas

## Repositorio

https://github.com/Giselle-Evy/price-tracker

## Ubicación local

C:\Users\evely\projects\price-tracker

## Entorno local

- Node.js v22.14.0
- pnpm 12.10.1
- Git 2.49.0
- Docker Desktop
- VS Code 1.140.0
- MySQL nativo en puerto 3306 (NO se toca, es de otros proyectos)
- MySQL del proyecto en Docker, puerto 3307
- Redis del proyecto en Docker, puerto 6380

## Cómo arrancar el proyecto desde cero

    git clone https://github.com/Giselle-Evy/price-tracker.git
    cd price-tracker
    cp .env.example .env
    docker compose up -d
    pnpm install

## Documentación de fases

Ver docs/PROGRESO.md para el historial completo de lo hecho fase por fase.
Ver docs/ARQUITECTURA.md para el diagrama y decisiones técnicas.
