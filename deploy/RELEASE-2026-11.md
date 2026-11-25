# Preparacion de despliegue: facturacion y cierres

## Destino confirmado

- Proyecto: `disco-song-382013`.
- Cuenta consultada: `gerencia@dacecia.com`.
- Cloud Run: `gestion-transporte-api`, region `us-central1`.
- Revision actualmente activa: `gestion-transporte-api-00009-lh6`, trafico 100%.
- Firebase Hosting: `https://disco-song-382013.web.app`.
- Release Hosting activa: `1795035622532000`, publicada el `2026-11-18T21:00:22.532Z`.
- Version Hosting activa: `172041ef1ff52cbe` (registrada para recuperacion).
- PostgreSQL 15: VM `vm-dace-cia`, zona `us-central1-a`, base `transporte`.
- La aplicacion debe conservar la conexion privada existente a `10.128.0.16`.
- Red y subred: `default`; salida VPC: `private-ranges-only`.
- Cuenta de servicio: `400917967326-compute@developer.gserviceaccount.com`.
- Secret Manager: conservar las referencias actuales de BD, JWT y OpenAI,
  sin reemplazarlas por valores locales ni imprimir su contenido.

No cambiar secretos, cuenta de servicio, red/VPC, CORS ni variables al actualizar
la imagen. No abrir el puerto PostgreSQL a Internet para este despliegue.

## Respaldo y ensayo realizados el 2026-11-25

- Respaldo remoto protegido: `/var/tmp/transporte-release-20261125-74995155/`.
- Copia local excluida de Git: `backups/transporte-release-20261125-74995155/`.
- Archivo: `database.dump`, formato custom de PostgreSQL.
- `SHA256SUMS`, `archive-list.txt` e `inventory.ndjson` acompanian el respaldo.
- SHA-256 verificado despues de descargar los tres archivos.
- Restauracion real en PostgreSQL local 16: verificada.
- Ocho migraciones pendientes: aplicadas solamente a la copia desechable.
- Integridad: las 35 tablas existentes conservaron cantidad y huella de sus filas.
- Segundo `prisma migrate deploy`: sin cambios.
- Resultado detallado: `rehearsal-report.json` junto al respaldo, fuera de Git.
- La base desechable fue eliminada; la base productiva no fue migrada.

Este respaldo sirve para el ensayo. Crear otro inmediatamente antes de publicar,
en la ventana acordada sin escrituras. Si hubo nuevas migraciones o cambios en
su SQL desde el ensayo, repetirlo antes de autorizar produccion.

## Migraciones pendientes

1. `20261119001000_add_facturacion`: tablas de configuracion, facturas, detalles y abonos.
2. `20261119002000_facturacion_indices`: unicidad y restricciones de facturacion.
3. `20261119003000_facturacion_defaults`: claves foraneas y predeterminados iniciales.
4. `20261119004000_facturas_borradores`: preparacion, version y numero opcional.
5. `20261120001000_viajes_destinatario`: destinatario nullable e indices.
6. `20261124001000_tarifa_ruta_inversa`: sentido inverso, inicialmente false.
7. `20261124002000_modalidad_comision`: descontar al pagar o en factura.
8. `20261124003000_comision_unica_cliente`: elimina dos porcentajes redundantes
   de la NUEVA tabla de configuracion. `clientes.porcentaje_comision` queda como
   predeterminado unico. No elimina porcentajes historicos de facturas/detalles.

Los predeterminados reconocen algunos nombres de clientes. Revisar su comision,
empresa destinataria e IR antes de preparar la primera factura; no son una
reclasificacion de viajes historicos ni sustituyen sus datos originales.

## Reglas de conservacion

- No cargar la BD local sobre produccion ni ejecutar seeds o scripts de ajuste.
- No repetir en produccion los cambios manuales de clientes hechos en local.
- No usar `prisma migrate dev`, `migrate reset` ni `db push` en produccion.
- Viajes cobrados: conservar estado, fecha, soporte e importes; sin factura inventada.
- Proveedores: conservar cobrado y pagado de forma independiente.
- `facturar_a_id`: NULL para viajes anteriores, propios y de proveedores.
- Cierres y snapshots: conservarlos. Cambios financieros posteriores se revisan
  con la alerta de diferencias y regeneracion explicita; no regenerar en masa.
- Verificar historicos usando los filtros de cobrados/finalizados: ocultarlos
  en el listado predeterminado no significa eliminarlos.

## Comprobaciones locales reproducibles

Desde `backend/`:

```powershell
npm run build
npm test
npm run release:check
npm run test:facturacion-cierre-local
npm run release:rehearse -- ../backups/transporte-release-20261125-74995155/database.dump
```

El ensayo solo admite PostgreSQL local, valida los checksums de las migraciones
ya aplicadas (admite LF/CRLF), crea una BD de nombre aleatorio y la elimina al
terminar. Nunca ejecuta migraciones sobre `DATABASE_URL` original.

Desde `frontend/`:

```powershell
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
npx playwright test e2e/weekly-closure.spec.ts e2e/proveedor-transporte.spec.ts --workers=1
```

El build conserva advertencias conocidas de tamano inicial y SweetAlert2 CommonJS.
Docker Desktop no estaba iniciado al preparar esta entrega: el contenedor debe
validarse mediante un build separado antes de mover trafico.

## Orden de publicacion, aun pendiente

1. Revisar el diff final y excluir credenciales, logs, respaldos y ajustes de IDE.
2. Crear commit, push y etiqueta de version; registrar SHA exacto y verificar CI.
3. Confirmar acceso a Firebase y Cloud Run con la cuenta indicada.
4. Acordar ventana sin escrituras y crear un respaldo fresco con SHA-256.
5. Registrar revision Cloud Run activa, release Hosting y configuracion de red.
6. Ejecutar `prisma migrate status` y luego `prisma migrate deploy` por conexion
   privada o tunel SSH seguro. No pegar claves en comandos ni guardarlas en Git.
7. Desplegar candidato de Cloud Run SIN trafico, conservando configuracion actual.
8. Verificar `/api/health`, conexion a BD y consultas con sesion autorizada.
9. Mover trafico a la revision validada; desplegar el frontend compilado en Hosting.
10. Revisar login web/movil, permisos de Facturacion, viajes historicos, filtros,
    cierres, alertas, preparacion de factura y reportes. No crear facturas reales
    ni marcar cobros como prueba sin autorizacion especifica.
11. Reabrir escrituras, monitorear errores y registrar versiones publicadas.

El deploy por `--source backend` utiliza `.gcloudignore` y `.dockerignore`.
No se debe invocar ningun script de `backend/scripts/` contra produccion salvo
que este disenado expresamente para ese uso; las pruebas de facturacion son locales.

## Recuperacion

Antes de autorizar nuevas escrituras, ante un fallo de la aplicacion regresar a
la revision anterior de Cloud Run y a la release anterior de Hosting. Las nuevas
tablas y columnas aditivas pueden permanecer: la version anterior no las usa.

No borrar las tablas nuevas para retroceder. Si ya se crearon facturas o abonos,
conservarlos y evaluar una correccion hacia adelante. Una restauracion completa
solo se realiza con autorizacion, escrituras detenidas y respaldo del estado
fallido: podria perder cambios posteriores al respaldo original.

Ejemplo de retorno de trafico al backend anterior (solo si sigue siendo el
anterior al publicar; verificarlo de nuevo):

```powershell
gcloud run services update-traffic gestion-transporte-api --project disco-song-382013 --region us-central1 --to-revisions gestion-transporte-api-00009-lh6=100
```
