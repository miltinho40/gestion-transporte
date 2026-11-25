import {
  toMoney,
  viajeFechaEntrega,
  isSundayDate,
  todayUtcDateOnly
} from './cierres-semanales.calculo.js';
import { type CierreData } from './cierres-semanales.data.js';
import { moneyString, type CierreRevision } from './cierres-semanales.revision.js';

export type AssistantAlertSeverity = 'info' | 'advertencia' | 'critica';

export type AssistantAlertType =
  | 'guias_faltantes'
  | 'gastos_inconsistentes'
  | 'utilidad_negativa'
  | 'retorno_sin_gasto'
  | 'domingo_sin_gasto'
  | 'sin_mantenimiento'
  | 'cierre_con_diferencias'
  | 'semana_abierta'
  | 'gastos_no_generados';

export const assistantSeverityWeight: Record<AssistantAlertSeverity, number> = {
  info: 1,
  advertencia: 3,
  critica: 6
};

export const buildAssistantAlert = (input: {
  id: string;
  tipo: AssistantAlertType;
  severidad: AssistantAlertSeverity;
  titulo: string;
  mensaje: string;
  accion_sugerida: string;
  source_type?: 'viaje' | 'mantenimiento' | 'cierre';
  source_id?: bigint | string | null;
}) => ({
  ...input,
  source_id:
    input.source_id === undefined || input.source_id === null ? null : String(input.source_id)
});

export const buildCierreAssistant = (cierre: CierreData, revision: CierreRevision) => {
  const alertas: ReturnType<typeof buildAssistantAlert>[] = [];
  const semanaTerminada = todayUtcDateOnly() > cierre.semana.fecha_fin;

  if (!semanaTerminada) {
    alertas.push(
      buildAssistantAlert({
        id: 'semana-abierta',
        tipo: 'semana_abierta',
        severidad: 'info',
        titulo: 'Semana abierta',
        mensaje:
          'La semana aun no termina. Puedes revisar valores, pero no conviene generar gastos todavia.',
        accion_sugerida: 'Revisar y esperar el cierre de la semana.',
        source_type: 'cierre'
      })
    );
  }

  if (semanaTerminada && cierre.resumen.cantidad_gastos_generados === 0) {
    alertas.push(
      buildAssistantAlert({
        id: 'gastos-no-generados',
        tipo: 'gastos_no_generados',
        severidad: 'advertencia',
        titulo: 'Gastos aun no generados',
        mensaje: 'La semana ya termino y aun no hay sueldos o bonos generados para este cierre.',
        accion_sugerida: 'Revisar las alertas y luego generar gastos.',
        source_type: 'cierre'
      })
    );
  }

  if (revision.requiere_revision) {
    alertas.push(
      buildAssistantAlert({
        id: 'cierre-con-diferencias',
        tipo: 'cierre_con_diferencias',
        severidad: 'critica',
        titulo: 'Cierre con diferencias',
        mensaje: `El cierre guardado tiene ${revision.total_diferencias} diferencia(s) contra el calculo actual.`,
        accion_sugerida: 'Revisar diferencias y regenerar gastos si corresponde.',
        source_type: 'cierre',
        source_id: revision.cierre_id
      })
    );
  }

  for (const viaje of cierre.viajes) {
    const guias = Array.isArray(viaje.numeros_guia_remision)
      ? viaje.numeros_guia_remision.map((guia) => String(guia ?? '').trim()).filter(Boolean)
      : [];
    const ruta = `${viaje.ruta.origen} - ${viaje.ruta.destino}`;
    const expectedCost = toMoney(viaje.viaticos)
      .plus(toMoney(viaje.gastos_viaje_total))
      .toDecimalPlaces(2);
    const realCost = toMoney(viaje.costo_real_gastos);
    const retornoGasto = toMoney(viaje.retorno_gastos_viaje);

    if (!guias.length) {
      alertas.push(
        buildAssistantAlert({
          id: `viaje-${viaje.id}-guias`,
          tipo: 'guias_faltantes',
          severidad: 'advertencia',
          titulo: 'Viaje sin guias',
          mensaje: `${ruta} no tiene guias de remision registradas.`,
          accion_sugerida: 'Agregar guias antes de facturar o cerrar la semana.',
          source_type: 'viaje',
          source_id: viaje.id
        })
      );
    }

    if (!realCost.equals(expectedCost)) {
      alertas.push(
        buildAssistantAlert({
          id: `viaje-${viaje.id}-gastos`,
          tipo: 'gastos_inconsistentes',
          severidad: 'critica',
          titulo: 'Gastos del viaje no cuadran',
          mensaje: `${ruta} tiene costo real $ ${moneyString(realCost)}, pero viaticos + gastos suman $ ${moneyString(expectedCost)}.`,
          accion_sugerida: 'Editar el viaje y recalcular/guardar los gastos reales.',
          source_type: 'viaje',
          source_id: viaje.id
        })
      );
    }

    if (toMoney(viaje.utilidad).lt(0)) {
      alertas.push(
        buildAssistantAlert({
          id: `viaje-${viaje.id}-utilidad`,
          tipo: 'utilidad_negativa',
          severidad: 'critica',
          titulo: 'Viaje con utilidad negativa',
          mensaje: `${ruta} deja una utilidad de $ ${moneyString(viaje.utilidad)}.`,
          accion_sugerida: 'Revisar precio a facturar, viaticos y gastos del viaje.',
          source_type: 'viaje',
          source_id: viaje.id
        })
      );
    }

    if (viaje.retorno && retornoGasto.lte(0)) {
      alertas.push(
        buildAssistantAlert({
          id: `viaje-${viaje.id}-retorno`,
          tipo: 'retorno_sin_gasto',
          severidad: 'advertencia',
          titulo: 'Retorno sin gasto RETORNO',
          mensaje: `${ruta} esta marcado como retorno, pero no tiene gasto tipo RETORNO.`,
          accion_sugerida: 'Agregar el gasto de retorno si corresponde.',
          source_type: 'viaje',
          source_id: viaje.id
        })
      );
    }

    if (isSundayDate(viajeFechaEntrega(viaje)) && retornoGasto.lte(0)) {
      alertas.push(
        buildAssistantAlert({
          id: `viaje-${viaje.id}-domingo`,
          tipo: 'domingo_sin_gasto',
          severidad: 'advertencia',
          titulo: 'Viaje domingo sin gasto RETORNO',
          mensaje: `${ruta} tiene entrega domingo y no registra gasto tipo RETORNO.`,
          accion_sugerida: 'Agregar el valor de domingo si aplica.',
          source_type: 'viaje',
          source_id: viaje.id
        })
      );
    }
  }

  if (cierre.resumen.cantidad_viajes > 0 && cierre.resumen.cantidad_mantenimientos === 0) {
    alertas.push(
      buildAssistantAlert({
        id: 'semana-sin-mantenimiento',
        tipo: 'sin_mantenimiento',
        severidad: 'info',
        titulo: 'Semana sin mantenimientos',
        mensaje:
          'Hay viajes en la semana, pero no se registro ningun mantenimiento para el vehiculo.',
        accion_sugerida: 'Confirmar que no hubo mantenimiento pendiente de registrar.',
        source_type: 'cierre'
      })
    );
  }

  const puntaje = alertas.reduce(
    (total, alerta) => total + assistantSeverityWeight[alerta.severidad],
    0
  );
  const riesgo = puntaje >= 9 ? 'alto' : puntaje >= 4 ? 'medio' : 'bajo';
  const criticas = alertas.filter((alerta) => alerta.severidad === 'critica').length;
  const advertencias = alertas.filter((alerta) => alerta.severidad === 'advertencia').length;

  return {
    disponible: true,
    riesgo,
    puntaje,
    total_alertas: alertas.length,
    resumen:
      alertas.length === 0
        ? 'No se detectaron novedades relevantes para este cierre.'
        : `Se detectaron ${alertas.length} novedad(es): ${criticas} critica(s), ${advertencias} advertencia(s).`,
    alertas
  };
};
