import { EstadoViaje, Prisma, TipoGastoSemanalVehiculo } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { BONUS_CONFIG_DEFAULTS, type BonusConfigKey } from './cierres-semanales.types.js';
import {
  toMoney,
  zeroMoney,
  addMoney,
  isRetornoGastoViaje,
  isSundayDate,
  buildViajeSemanaWhere,
  getIsoWeekRange,
  calculateBonificacion,
  calculatePagoSemanalConductor
} from './cierres-semanales.calculo.js';

export const getBonusConfig = async (propietarioId: bigint) => {
  const keys = Object.keys(BONUS_CONFIG_DEFAULTS) as BonusConfigKey[];
  const configs = await prisma.configuracionOperativa.findMany({
    where: {
      clave: { in: keys },
      OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
    }
  });

  const values: Record<BonusConfigKey, number> = { ...BONUS_CONFIG_DEFAULTS };

  for (const key of keys) {
    const own = configs.find((item) => item.clave === key && item.propietario_id === propietarioId);
    const global = configs.find((item) => item.clave === key && item.propietario_id === null);
    const selected = own ?? global;
    const parsed = Number(selected?.valor);

    if (Number.isFinite(parsed) && parsed >= 0) {
      values[key] = parsed;
    }
  }

  return {
    bonificacion_flete_monto_minimo: toMoney(values.bonificacion_flete_monto_minimo),
    bonificacion_flete_monto_tramo: toMoney(values.bonificacion_flete_monto_tramo || 100),
    bonificacion_flete_valor_tramo: toMoney(values.bonificacion_flete_valor_tramo),
    bonificacion_flete_monto_maximo: toMoney(values.bonificacion_flete_monto_maximo)
  };
};

export const getPagosSemanalesConductores = async (
  propietarioId: bigint | null,
  anio: number,
  numeroSemana: number,
  conductorId?: bigint
) => {
  const { fechaInicio, fechaFin } = getIsoWeekRange(anio, numeroSemana);
  const ownerFilter = propietarioId ? { propietario_id: propietarioId } : {};
  const conductorFilter = conductorId ? { conductor_id: conductorId } : {};
  const [viajes, gastosGenerados] = await Promise.all([
    prisma.viaje.findMany({
      where: {
        ...ownerFilter,
        ...conductorFilter,
        estado: { not: EstadoViaje.CANCELADO },
        ...buildViajeSemanaWhere(fechaInicio, fechaFin)
      },
      select: {
        propietario_id: true,
        conductor_id: true,
        fecha_salida: true,
        fecha_llegada: true,
        precio_flete: true,
        retorno: true,
        conductor: {
          select: {
            id: true,
            propietario_id: true,
            nombre: true,
            cedula: true,
            sueldo_semanal: true
          }
        },
        gastos_viaje: {
          select: {
            monto: true,
            tipo_gasto: { select: { nombre: true } }
          }
        }
      },
      orderBy: [{ conductor_id: 'asc' }, { fecha_llegada: 'asc' }, { id: 'asc' }]
    }),
    prisma.gastoSemanalVehiculo.findMany({
      where: {
        ...ownerFilter,
        anio,
        numero_semana: numeroSemana,
        tipo: {
          in: [
            TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR,
            TipoGastoSemanalVehiculo.BONIFICACION_CONDUCTOR
          ]
        },
        conductor_id: conductorId ?? { not: null }
      },
      select: {
        conductor_id: true,
        tipo: true,
        monto: true,
        conductor: {
          select: {
            id: true,
            propietario_id: true,
            nombre: true,
            cedula: true,
            sueldo_semanal: true
          }
        }
      }
    })
  ]);

  type ConductorPagoGrupo = {
    conductor: NonNullable<(typeof gastosGenerados)[number]['conductor']>;
    cantidad_viajes: number;
    cantidad_retornos: number;
    cantidad_domingos: number;
    total_fletes: Prisma.Decimal;
    retornos: Prisma.Decimal;
    domingos: Prisma.Decimal;
    sueldo_generado: Prisma.Decimal;
    bono_generado: Prisma.Decimal;
    tiene_sueldo_generado: boolean;
    tiene_bono_generado: boolean;
  };
  const grupos = new Map<string, ConductorPagoGrupo>();
  const getGrupo = (conductor: ConductorPagoGrupo['conductor']) => {
    const key = conductor.id.toString();
    const current = grupos.get(key) ?? {
      conductor,
      cantidad_viajes: 0,
      cantidad_retornos: 0,
      cantidad_domingos: 0,
      total_fletes: zeroMoney(),
      retornos: zeroMoney(),
      domingos: zeroMoney(),
      sueldo_generado: zeroMoney(),
      bono_generado: zeroMoney(),
      tiene_sueldo_generado: false,
      tiene_bono_generado: false
    };
    grupos.set(key, current);
    return current;
  };

  for (const viaje of viajes) {
    const grupo = getGrupo(viaje.conductor);
    const gastoRetorno = viaje.gastos_viaje
      .filter((gasto) => isRetornoGastoViaje(gasto.tipo_gasto.nombre))
      .reduce((total, gasto) => addMoney(total, gasto.monto), zeroMoney());
    const fechaEntrega = viaje.fecha_llegada ?? viaje.fecha_salida;

    grupo.cantidad_viajes += 1;
    grupo.total_fletes = addMoney(grupo.total_fletes, viaje.precio_flete);
    if (viaje.retorno) {
      grupo.cantidad_retornos += 1;
      grupo.retornos = addMoney(grupo.retornos, gastoRetorno);
    }
    if (isSundayDate(fechaEntrega)) {
      grupo.cantidad_domingos += 1;
      grupo.domingos = addMoney(grupo.domingos, gastoRetorno);
    }
  }

  for (const gasto of gastosGenerados) {
    if (!gasto.conductor) continue;
    const grupo = getGrupo(gasto.conductor);
    if (gasto.tipo === TipoGastoSemanalVehiculo.SUELDO_CONDUCTOR) {
      grupo.tiene_sueldo_generado = true;
      grupo.sueldo_generado = addMoney(grupo.sueldo_generado, gasto.monto);
    } else {
      grupo.tiene_bono_generado = true;
      grupo.bono_generado = addMoney(grupo.bono_generado, gasto.monto);
    }
  }

  const propietarios = [
    ...new Set([...grupos.values()].map((grupo) => grupo.conductor.propietario_id.toString()))
  ];
  const configuraciones = new Map<string, Awaited<ReturnType<typeof getBonusConfig>>>();
  await Promise.all(
    propietarios.map(async (id) => {
      configuraciones.set(id, await getBonusConfig(BigInt(id)));
    })
  );

  return [...grupos.values()]
    .map((grupo) => {
      const config = configuraciones.get(grupo.conductor.propietario_id.toString());
      const sueldo = grupo.tiene_sueldo_generado
        ? grupo.sueldo_generado
        : grupo.cantidad_viajes
          ? toMoney(grupo.conductor.sueldo_semanal)
          : zeroMoney();
      const bono = grupo.tiene_bono_generado
        ? grupo.bono_generado
        : grupo.cantidad_viajes && config
          ? calculateBonificacion(grupo.total_fletes, config)
          : zeroMoney();
      const total = calculatePagoSemanalConductor({
        sueldo,
        bono,
        retornos: grupo.retornos,
        domingos: grupo.domingos
      });

      return {
        conductor: grupo.conductor,
        semana: {
          anio,
          numero_semana: numeroSemana,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin
        },
        cantidad_viajes: grupo.cantidad_viajes,
        cantidad_retornos: grupo.cantidad_retornos,
        cantidad_domingos: grupo.cantidad_domingos,
        total_fletes: grupo.total_fletes,
        sueldo,
        bono,
        retornos: grupo.retornos,
        domingos: grupo.domingos,
        total,
        sueldo_generado: grupo.tiene_sueldo_generado,
        bono_generado: grupo.tiene_bono_generado
      };
    })
    .sort((left, right) => {
      const totalCompare = right.total.comparedTo(left.total);
      return totalCompare || left.conductor.nombre.localeCompare(right.conductor.nombre);
    });
};
