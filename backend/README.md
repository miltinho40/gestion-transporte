# Backend - Gestion Transporte

Backend base para el sistema de gestion de transporte de carga.

## Stack

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- JWT

## Arranque local

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

Despues de crear la primera migracion Prisma, revisar `prisma/manual-indexes.sql` para agregar los indices parciales de PostgreSQL que Prisma no modela directamente.

## Endpoints base

```txt
GET /api/health
```
