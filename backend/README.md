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

## Sesiones

La autenticacion usa dos credenciales:

- Un access token JWT de corta duracion, conservado solamente en memoria por el frontend.
- Un refresh token aleatorio, rotatorio y almacenado como cookie `HttpOnly`.

Endpoints:

```txt
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

Las sesiones activas se guardan en `sesiones_usuario`. Cambiar o resetear una
clave revoca las demas sesiones del usuario. Las claves temporales se generan
aleatoriamente y obligan al usuario a definir una nueva en el primer ingreso.

Variables relevantes:

```txt
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
TRUST_PROXY_HOPS=0
```

En Cloud Run configura `TRUST_PROXY_HOPS=1` para registrar correctamente la IP
en auditoria. En local debe permanecer en `0`.

## Verificacion

```powershell
npm run build
npm test
```

El pipeline `.github/workflows/ci.yml` levanta PostgreSQL, aplica migraciones y
ejecuta pruebas backend, frontend y E2E en escritorio y movil.
