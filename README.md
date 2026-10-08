# Price Tracker

Plataforma web de web scraping, monitoreo e historial de precios.

## ¿Qué hace?

Permite a los usuarios:
- Analizar páginas web y seleccionar visualmente elementos para extraer.
- Guardar configuraciones de scraping reutilizables.
- Convertirlas en monitores de producto.
- Ejecutar extracciones automáticas cada 5, 15 o 30 minutos.
- Guardar el historial de precios y visualizarlo en gráficas tipo Keepa.
- Recibir notificaciones cuando el precio baja o alcanza un objetivo.

## Estado

En desarrollo - Fase 0: configuracion del entorno.

## Requisitos

- Node.js >= 20
- pnpm >= 9
- Docker Desktop
- Git

## Instalacion

    git clone https://github.com/Giselle-Evy/price-tracker.git
    cd price-tracker
    pnpm install
    cp .env.example .env
    docker compose up -d

## Estructura

- apps/web - Frontend React + TypeScript
- apps/api - Backend Express + Prisma
- apps/worker - Proceso de scraping programado (BullMQ + Playwright)
- packages/shared - Tipos y validaciones compartidas

## Licencia

Privado.
