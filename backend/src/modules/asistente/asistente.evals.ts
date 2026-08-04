import type { AsistenteMensajeInput } from './asistente.schema.js';
import type { AssistantToolName } from './asistente.tools.js';

export interface AssistantEvaluationCase {
  id: string;
  categoria: string;
  input: AsistenteMensajeInput;
  herramienta_esperada: AssistantToolName;
}

const groups: Array<{
  categoria: string;
  herramienta: AssistantToolName;
  mensajes: string[];
}> = [
  {
    categoria: 'viajes_pendientes',
    herramienta: 'consultar_viajes',
    mensajes: [
      'Muéstrame los viajes pendientes de cobro',
      'Qué viajes están por cobrar',
      'Lista los viajes sin cobrar',
      'Viajes pendientes del OAA1227',
      'Cuáles son los cobros pendientes de esta semana',
      'Muéstrame lo pendiente del cliente Transpalfra',
      'Consulta los viajes por cobrar de junio',
      'Necesito revisar viajes sin cobrar',
      'Estado de cobro de los viajes',
      'Dame los viajes pendientes de la semana 26'
    ]
  },
  {
    categoria: 'mantenimientos_consulta',
    herramienta: 'consultar_mantenimientos',
    mensajes: [
      'Muéstrame los mantenimientos de este mes',
      'Cuál fue el último cambio de aceite del OAA1588',
      'Dame los dos últimos cambios de aceite del carro OAA1588',
      'Consulta mantenimientos del OAA1227',
      'Qué mantenimientos se hicieron en junio',
      'Último mantenimiento del vehículo OAA5313',
      'Lista el historial de aceite del OAA1588',
      'Mantenimientos realizados esta semana',
      'Cuándo fue el cambio de aceite del OAA1227',
      'Revisa los mantenimientos del vehículo OAA5313'
    ]
  },
  {
    categoria: 'cierre_semanal',
    herramienta: 'analizar_operacion',
    mensajes: [
      'Revisa el cierre de la semana 26',
      'Muéstrame el cierre semanal del OAA1227',
      'Cómo quedó el cierre de la semana 23',
      'Consulta el cierre semanal de Vicente',
      'Dame el cierre de esta semana',
      'Hay anomalías en el cierre de la semana 22',
      'Resumen del cierre semanal del OAA5313',
      'Cuál fue la ganancia del cierre 26',
      'Revisemos el cierre semanal anterior',
      'Estado del cierre de la semana 24'
    ]
  },
  {
    categoria: 'viajes_creacion',
    herramienta: 'preparar_viaje',
    mensajes: [
      'Crea un viaje a Vinces',
      'Agrega un viaje para hoy',
      'Registra un viaje del OAA1227 a Guayaquil',
      'Crear viaje para el cliente Transpalfra',
      'Agrega nuevo viaje a San Juan',
      'Registra el viaje de mañana a Durán',
      'Crea un viaje con guía 230045',
      'Quiero crear un viaje para Jimmy Calderón',
      'Agregar viaje Machala Vinces con viático 135',
      'Registrar viaje del vehículo OAA5313'
    ]
  },
  {
    categoria: 'mantenimientos_creacion',
    herramienta: 'preparar_mantenimiento',
    mensajes: [
      'Crea un mantenimiento de aceite',
      'Agrega un mantenimiento para hoy',
      'Registra un mantenimiento del OAA1227',
      'Crear mantenimiento por cambio de llantas',
      'Agrega nuevo mantenimiento al OAA1588',
      'Registra el mantenimiento de frenos',
      'Crea un mantenimiento con costo 200',
      'Quiero crear un mantenimiento preventivo',
      'Agregar mantenimiento de motor',
      'Registrar mantenimiento del vehículo OAA5313'
    ]
  },
  {
    categoria: 'abrir_formularios',
    herramienta: 'abrir_formulario',
    mensajes: [
      'Abre el formulario de un nuevo viaje',
      'Muéstrame el modal para nuevo viaje',
      'Abrir pantalla para crear un viaje',
      'Abre el formulario de un nuevo cliente',
      'Muéstrame el modal de nuevo cliente',
      'Abrir pantalla para nuevo vehículo',
      'Abre el formulario de un nuevo conductor',
      'Muéstrame la pantalla para nuevo conductor',
      'Abrir modal para crear vehículo',
      'Abre el modal para nuevo viaje'
    ]
  },
  {
    categoria: 'analitica',
    herramienta: 'analizar_operacion',
    mensajes: [
      'Cuál vehículo facturó más en la semana 26',
      'Cuánto ganó Harold en la semana 26',
      'Qué cliente generó mayor utilidad este mes',
      'Compara la facturación de los vehículos',
      'Dame el top de clientes por facturación',
      'Cuál conductor recibió más pagos en junio',
      'Promedio de utilidad por viaje',
      'Qué ruta generó mayor ganancia',
      'Ranking de vehículos por valor facturado',
      'Cuánto recibió Vicente por sus viajes'
    ]
  },
  {
    categoria: 'proveedores',
    herramienta: 'consultar_viajes',
    mensajes: [
      'Muéstrame los viajes de proveedores',
      'Qué proveedor tiene viajes pendientes',
      'Consulta los pagos del proveedor Juan Pérez',
      'Viajes realizados por el proveedor Transcarga',
      'Dame el resumen del proveedor de junio',
      'Cuáles viajes del proveedor están cobrados',
      'Lista los viajes del proveedor esta semana',
      'Revisa el pago al proveedor Carlos',
      'Consulta viajes pagados al proveedor',
      'Muéstrame proveedores con viajes en mayo'
    ]
  },
  {
    categoria: 'preferencias',
    herramienta: 'consultar_preferencias',
    mensajes: [
      'Qué recuerdas de mí',
      'Qué tienes guardado',
      'Muéstrame mis preferencias',
      'Consulta mis preferencias',
      'Qué recuerdas de mi vehículo habitual',
      'Muestra mis preferencias del asistente',
      'Qué tienes guardado sobre Transpalfra',
      'Dime qué recuerdas de mí',
      'Quiero ver mis preferencias',
      'Muestra mis preferencias actuales'
    ]
  },
  {
    categoria: 'viajes_consulta',
    herramienta: 'consultar_viajes',
    mensajes: [
      'Muéstrame los viajes de la semana 22',
      'Cuál fue el último viaje de Darwin',
      'Déjame ver el último viaje a Vinces del OAA1588',
      'Dame los viajes del cliente Jimmy Calderón',
      'Consulta viajes del OAA1227 en junio',
      'Muéstrame el último viaje a San Juan',
      'Lista los viajes de Vicente',
      'Viajes realizados ayer',
      'Consulta la facturación de viajes de mayo',
      'Dame el detalle de viajes de la semana 23'
    ]
  }
];

export const assistantEvaluationBank: AssistantEvaluationCase[] = groups.flatMap(
  (group, groupIndex) =>
    group.mensajes.map((mensaje, messageIndex) => ({
      id: `E${String(groupIndex + 1).padStart(2, '0')}-${String(messageIndex + 1).padStart(2, '0')}`,
      categoria: group.categoria,
      input: { mensaje, canal: 'web' },
      herramienta_esperada: group.herramienta
    }))
);
