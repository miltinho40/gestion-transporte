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

PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npx prisma migrate dev --create-only --name init
```

Luego agrega el contenido de `prisma/manual-indexes.sql` al final del archivo SQL generado en `prisma/migrations/*/migration.sql`.

Despues ejecuta:

```powershell
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Los indices parciales son necesarios para garantizar unicidad entre registros globales (`propietario_id IS NULL`) y registros propios de cada propietario.

## Endpoints base

```txt
GET /api/health
```
