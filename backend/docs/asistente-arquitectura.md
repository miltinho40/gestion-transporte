# Asistente operativo

## Alcance actual

El asistente admite texto y dictado por voz desde web y movil. Puede:

- Consultar viajes propios, viajes de proveedores, mantenimientos y cierres semanales.
- Mantener filtros de una consulta de viajes entre mensajes consecutivos.
- Preparar borradores para crear o editar viajes y mantenimientos.
- Solicitar datos faltantes y mostrar coincidencias de rutas.
- Aplicar un borrador solo despues de una confirmacion explicita.

## Intenciones soportadas

| Intencion | Herramienta | Escritura | Confirmacion |
| --- | --- | --- | --- |
| Consultar viajes | `consultar_viajes` | No | No |
| Consultar viajes pendientes | `consultar_viajes_pendientes` | No | No |
| Consultar viajes de proveedores | `consultar_viajes_proveedor` | No | No |
| Consultar mantenimientos | `consultar_mantenimientos` | No | No |
| Consultar cierre semanal | `consultar_cierre_semanal` | No | No |
| Preparar viaje | `preparar_viaje` | No | No |
| Preparar mantenimiento | `preparar_mantenimiento` | No | No |
| Preparar edicion | `preparar_edicion` | No | No |
| Cancelar borrador | `cancelar_borrador` | No | No |
| Guardar viaje o mantenimiento | `aplicar_borrador` | Si | Si |

## Limites de seguridad

- El propietario y el usuario se obtienen exclusivamente del JWT.
- El asistente no ejecuta SQL ni recibe un `propietario_id` desde el mensaje.
- Las escrituras reutilizan los servicios y esquemas Zod de cada modulo.
- Toda escritura requiere borrador vigente y confirmacion explicita.
- Cada mensaje, borrador y herramienta se registra para trazabilidad.
- Una conversacion solo puede ser leida por el usuario y propietario que la crearon.

## Flujo

1. El usuario envia texto o voz junto con el identificador de conversacion.
2. El orquestador restaura el contexto persistido si el cliente no lo envia.
3. El interprete configurado elige una herramienta, genera un mensaje canonico
   y extrae parametros estructurados.
4. El catalogo valida la herramienta contra los roles del usuario.
5. El motor determinista ejecuta la consulta o prepara el borrador.
6. Se guarda el mensaje original, la interpretacion, la respuesta y la ejecucion.
7. Las acciones de escritura solo se aplican luego de la confirmacion del usuario.

## Interpretacion hibrida

El proveedor se controla con `AI_PROVIDER`:

- `rules`: usa solamente el motor local y no consume una API externa.
- `openai`: usa Responses API con salida JSON estructurada y luego ejecuta el
  mismo motor local.

El modelo predeterminado es `gpt-5.6-luna` y puede cambiarse con
`OPENAI_MODEL`. Si falta `OPENAI_API_KEY`, la API falla, la confianza es menor
que `OPENAI_MIN_CONFIDENCE` o el modelo elige una herramienta no permitida, el
sistema vuelve automaticamente a las reglas.

El modelo no recibe `usuario_id` ni `propietario_id`. Solo recibe el mensaje,
el canal y el contexto operativo de la conversacion. El identificador de
seguridad enviado al proveedor es un hash y no permite recuperar el usuario.
Cada ejecucion guarda el modelo, la confianza, el identificador de respuesta y
los tokens consumidos para facilitar auditoria y control de costos.

Las confirmaciones y los borradores activos no se delegan al modelo. La IA no
consulta la base de datos, no ejecuta herramientas y no construye operaciones
de escritura; esas responsabilidades permanecen dentro del backend.

Para crear registros, el modelo separa valores por significado, por ejemplo
`capacidad=7000` y `viaticos=135`. El backend resuelve cliente, vehiculo,
conductor y tarifa contra los datos autorizados del propietario. Las fechas
relativas se interpretan en `America/Guayaquil`.
