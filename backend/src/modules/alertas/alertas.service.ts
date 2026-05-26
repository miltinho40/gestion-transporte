import { EstadoConductor, EstadoMantenimiento, EstadoViaje, EstadoVehiculo } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { parseBigIntId } from '../../utils/ids.js';

const CONFIG_DEFAULTS = {
  alerta_mantenimiento_km_anticipacion: 500,
  alerta_licencia_dias_anticipacion: 90,
  alerta_viaje_sin_cobrar_semanas: 5
} as const;

type ConfigKey = keyof typeof CONFIG_DEFAULTS;

const prismaToApiEstadoConductor = {
  [EstadoConductor.ACTIVO]: 'activo',
  [EstadoConductor.INACTIVO]: 'inactivo',
  [EstadoConductor.LICENCIA_VENCIDA]: 'licencia_vencida'
};

const prismaToApiEstadoVehiculo = {
  [EstadoVehiculo.DISPONIBLE]: 'disponible',
  [EstadoVehiculo.EN_VIAJE]: 'en_viaje',
  [EstadoVehiculo.EN_MANTENIMIENTO]: 'en_mantenimiento',
  [EstadoVehiculo.INACTIVO]: 'inactivo'
};

const prismaToApiEstadoViaje = {
  [EstadoViaje.PROGRAMADO]: 'programado',
  [EstadoViaje.EN_CURSO]: 'en_curso',
  [EstadoViaje.COMPLETADO]: 'completado',
  [EstadoViaje.CANCELADO]: 'cancelado'
};

const prismaToApiEstadoMantenimiento = {
  [EstadoMantenimiento.PROGRAMADO]: 'programado',
  [EstadoMantenimiento.REALIZADO]: 'realizado',
  [EstadoMantenimiento.CANCELADO]: 'cancelado',
  [EstadoMantenimiento.VENCIDO]: 'vencido'
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const diffDays = (from: Date, to: Date) => {
  const millis = to.getTime() - from.getTime();
  return Math.ceil(millis / 86_400_000);
};

const getNumericConfigs = async (propietarioId: bigint) => {
  const keys = Object.keys(CONFIG_DEFAULTS) as ConfigKey[];
  const configs = await prisma.configuracionOperativa.findMany({
    where: {
      clave: { in: keys },
      OR: [{ propietario_id: null }, { propietario_id: propietarioId }]
    }
  });

  const values: Record<ConfigKey, number> = { ...CONFIG_DEFAULTS };

  for (const key of keys) {
    const own = configs.find(
      (item) => item.clave === key && item.propietario_id === propietarioId
    );
    const global = configs.find((item) => item.clave === key && item.propietario_id === null);
    const selected = own ?? global;
    const parsed = Number(selected?.valor);

    if (Number.isFinite(parsed) && parsed >= 0) {
      values[key] = parsed;
    }
  }

  return {
    alerta_mantenimiento_km_anticipacion: Math.trunc(
      values.alerta_mantenimiento_km_anticipacion
    ),
    alerta_licencia_dias_anticipacion: Math.trunc(values.alerta_licencia_dias_anticipacion),
    alerta_viaje_sin_cobrar_semanas: Math.trunc(values.alerta_viaje_sin_cobrar_semanas)
  };
};

export const listAlertasMantenimientos = async (propietarioIdInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const configs = await getNumericConfigs(propietarioId);
  const mantenimientoKmAnticipacion = configs.alerta_mantenimiento_km_anticipacion;

  const mantenimientos = await prisma.mantenimiento.findMany({
    where: {
      propietario_id: propietarioId,
      estado: { not: EstadoMantenimiento.CANCELADO },
      proximo_mantenimiento_km: { not: null }
    },
    include: {
      vehiculo: true,
      tipo_mantenimiento: true
    },
    orderBy: [{ fecha_mantenimiento: 'desc' }, { id: 'desc' }]
  });

  const latestByVehicleAndType = new Map<string, (typeof mantenimientos)[number]>();

  for (const mantenimiento of mantenimientos) {
    const key = `${mantenimiento.vehiculo_id}:${mantenimiento.tipo_mantenimiento_id}`;

    if (!latestByVehicleAndType.has(key)) {
      latestByVehicleAndType.set(key, mantenimiento);
    }
  }

  const items = [...latestByVehicleAndType.values()]
    .map((mantenimiento) => {
      const kmRestantes =
        mantenimiento.proximo_mantenimiento_km! - mantenimiento.vehiculo.kilometraje_actual;

      if (kmRestantes > mantenimientoKmAnticipacion) {
        return null;
      }

      return {
        tipo_alerta: 'mantenimiento',
        estado_alerta: kmRestantes <= 0 ? 'vencido' : 'por_vencer',
        mantenimiento_id: mantenimiento.id,
        vehiculo_id: mantenimiento.vehiculo_id,
        placa: mantenimiento.vehiculo.placa,
        vehiculo: {
          id: mantenimiento.vehiculo.id,
          placa: mantenimiento.vehiculo.placa,
          marca: mantenimiento.vehiculo.marca,
          modelo: mantenimiento.vehiculo.modelo,
          kilometraje_actual: mantenimiento.vehiculo.kilometraje_actual,
          estado: prismaToApiEstadoVehiculo[mantenimiento.vehiculo.estado]
        },
        tipo_mantenimiento: {
          id: mantenimiento.tipo_mantenimiento.id,
          nombre: mantenimiento.tipo_mantenimiento.nombre
        },
        fecha_mantenimiento: mantenimiento.fecha_mantenimiento,
        kilometraje_actual_vehiculo: mantenimiento.kilometraje_actual_vehiculo,
        proximo_mantenimiento_km: mantenimiento.proximo_mantenimiento_km,
        km_restantes: kmRestantes,
        estado_mantenimiento: prismaToApiEstadoMantenimiento[mantenimiento.estado]
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.km_restantes - b.km_restantes);

  return {
    configuracion: {
      alerta_mantenimiento_km_anticipacion: mantenimientoKmAnticipacion
    },
    total: items.length,
    vencidos: items.filter((item) => item.estado_alerta === 'vencido').length,
    por_vencer: items.filter((item) => item.estado_alerta === 'por_vencer').length,
    items
  };
};

export const listAlertasLicencias = async (propietarioIdInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const configs = await getNumericConfigs(propietarioId);
  const licenciaDiasAnticipacion = configs.alerta_licencia_dias_anticipacion;
  const today = todayDateOnly();
  const limite = addDays(today, licenciaDiasAnticipacion);

  const conductores = await prisma.conductor.findMany({
    where: {
      propietario_id: propietarioId,
      estado: { not: EstadoConductor.INACTIVO },
      fecha_caducidad_licencia: { lte: limite }
    },
    orderBy: [{ fecha_caducidad_licencia: 'asc' }, { nombre: 'asc' }]
  });

  const items = conductores.map((conductor) => {
    const diasRestantes = diffDays(today, conductor.fecha_caducidad_licencia);

    return {
      tipo_alerta: 'licencia',
      estado_alerta: diasRestantes < 0 ? 'vencida' : 'por_caducar',
      conductor_id: conductor.id,
      nombre: conductor.nombre,
      cedula: conductor.cedula,
      numero_licencia: conductor.numero_licencia,
      fecha_caducidad_licencia: conductor.fecha_caducidad_licencia,
      dias_restantes: diasRestantes,
      estado_conductor: prismaToApiEstadoConductor[conductor.estado]
    };
  });

  return {
    configuracion: {
      alerta_licencia_dias_anticipacion: licenciaDiasAnticipacion
    },
    total: items.length,
    vencidas: items.filter((item) => item.estado_alerta === 'vencida').length,
    por_caducar: items.filter((item) => item.estado_alerta === 'por_caducar').length,
    items
  };
};

export const listAlertasViajesSinCobrar = async (propietarioIdInput: unknown) => {
  const propietarioId = parseBigIntId(propietarioIdInput, 'propietario_id');
  const configs = await getNumericConfigs(propietarioId);
  const viajeSinCobrarSemanas = configs.alerta_viaje_sin_cobrar_semanas;
  const today = todayDateOnly();
  const fechaLimite = addDays(today, -(viajeSinCobrarSemanas * 7));

  const viajes = await prisma.viaje.findMany({
    where: {
      propietario_id: propietarioId,
      cobrado: false,
      estado: { not: EstadoViaje.CANCELADO },
      fecha_salida: { lt: fechaLimite }
    },
    include: {
      cliente: true,
      vehiculo: true,
      conductor: true,
      tarifa_ruta: {
        include: {
          ruta: true,
          tipo_carga: true
        }
      }
    },
    orderBy: [{ fecha_salida: 'asc' }, { id: 'asc' }]
  });

  const items = viajes.map((viaje) => {
    const diasPendiente = Math.max(0, -diffDays(today, viaje.fecha_salida));

    return {
      tipo_alerta: 'viaje_sin_cobrar',
      estado_alerta: 'vencido',
      viaje_id: viaje.id,
      fecha_salida: viaje.fecha_salida,
      dias_pendiente: diasPendiente,
      semanas_pendiente: Math.floor(diasPendiente / 7),
      cliente: {
        id: viaje.cliente.id,
        nombre: viaje.cliente.nombre,
        ruc_cedula: viaje.cliente.ruc_cedula
      },
      vehiculo: {
        id: viaje.vehiculo.id,
        placa: viaje.vehiculo.placa,
        marca: viaje.vehiculo.marca,
        modelo: viaje.vehiculo.modelo,
        estado: prismaToApiEstadoVehiculo[viaje.vehiculo.estado]
      },
      conductor: {
        id: viaje.conductor.id,
        nombre: viaje.conductor.nombre,
        estado: prismaToApiEstadoConductor[viaje.conductor.estado]
      },
      ruta: {
        id: viaje.tarifa_ruta.ruta.id,
        origen: viaje.tarifa_ruta.ruta.origen,
        destino: viaje.tarifa_ruta.ruta.destino
      },
      precio_flete: viaje.precio_flete,
      precio_real_flete: viaje.precio_real_flete,
      estado_viaje: prismaToApiEstadoViaje[viaje.estado]
    };
  });

  return {
    configuracion: {
      alerta_viaje_sin_cobrar_semanas: viajeSinCobrarSemanas,
      fecha_limite: fechaLimite
    },
    total: items.length,
    items
  };
};

export const listAlertas = async (propietarioIdInput: unknown) => {
  const [mantenimientos, licencias, viajesSinCobrar] = await Promise.all([
    listAlertasMantenimientos(propietarioIdInput),
    listAlertasLicencias(propietarioIdInput),
    listAlertasViajesSinCobrar(propietarioIdInput)
  ]);

  return {
    resumen: {
      total: mantenimientos.total + licencias.total + viajesSinCobrar.total,
      mantenimientos: {
        total: mantenimientos.total,
        vencidos: mantenimientos.vencidos,
        por_vencer: mantenimientos.por_vencer
      },
      licencias: {
        total: licencias.total,
        vencidas: licencias.vencidas,
        por_caducar: licencias.por_caducar
      },
      viajes_sin_cobrar: {
        total: viajesSinCobrar.total
      }
    },
    configuraciones: {
      ...mantenimientos.configuracion,
      ...licencias.configuracion,
      ...viajesSinCobrar.configuracion
    },
    mantenimientos: mantenimientos.items,
    licencias: licencias.items,
    viajes_sin_cobrar: viajesSinCobrar.items
  };
};
