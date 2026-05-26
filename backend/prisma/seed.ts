import 'dotenv/config';
import {
  EstadoMantenimiento,
  EstadoViaje,
  PrismaClient,
  SentidoPeaje
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const toDateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

const demoPassword = 'demo123456';

const seedRoles = async () => {
  const roles = [
    { nombre: 'admin', descripcion: 'Administrador del propietario' },
    { nombre: 'operador', descripcion: 'Gestion operativa diaria' },
    { nombre: 'supervisor', descripcion: 'Revision y reportes' },
    { nombre: 'consulta', descripcion: 'Acceso de solo lectura' }
  ];

  for (const role of roles) {
    await prisma.rol.upsert({
      where: { nombre: role.nombre },
      update: { descripcion: role.descripcion },
      create: role
    });
  }
};

const seedSuperAdmin = async () => {
  const password_hash = await bcrypt.hash('admin123456', 10);

  await prisma.usuario.upsert({
    where: { email: 'admin@local.test' },
    update: {
      nombre: 'Administrador',
      es_super_admin: true,
      email_verificado: true,
      requiere_password: false,
      activo: true
    },
    create: {
      nombre: 'Administrador',
      email: 'admin@local.test',
      password_hash,
      es_super_admin: true,
      email_verificado: true,
      requiere_password: false
    }
  });
};

const seedTiposCarga = async () => {
  const tipos = [
    { nombre: 'cartones', descripcion: 'Carga medida en cartones' },
    { nombre: 'pallets', descripcion: 'Carga transportada en pallets' },
    { nombre: 'granel', descripcion: 'Carga a granel' },
    { nombre: 'refrigerada', descripcion: 'Carga con control de temperatura' },
    { nombre: 'otros', descripcion: 'Otros tipos de carga' }
  ];

  for (const tipo of tipos) {
    const actual = await prisma.tipoCarga.findFirst({
      where: { propietario_id: null, nombre: tipo.nombre }
    });

    if (actual) {
      await prisma.tipoCarga.update({
        where: { id: actual.id },
        data: { descripcion: tipo.descripcion, activo: true }
      });
    } else {
      await prisma.tipoCarga.create({
        data: tipo
      });
    }
  }
};

const seedTiposGastoViaje = async () => {
  const tipos = [
    { nombre: 'diesel', descripcion: 'Combustible del viaje' },
    { nombre: 'peaje', descripcion: 'Peajes del viaje' },
    { nombre: 'alimentacion', descripcion: 'Alimentacion del conductor' },
    { nombre: 'hospedaje', descripcion: 'Hospedaje del conductor' },
    { nombre: 'parqueadero', descripcion: 'Parqueadero u otros estacionamientos' },
    { nombre: 'otros', descripcion: 'Otros gastos del viaje' }
  ];

  for (const tipo of tipos) {
    await prisma.tipoGastoViaje.upsert({
      where: { nombre: tipo.nombre },
      update: { descripcion: tipo.descripcion, activo: true },
      create: tipo
    });
  }
};

const seedCategoriasPeaje = async () => {
  const categorias = [
    { nombre: 'carro_pequeno', numero_ejes: null, descripcion: 'Vehiculo liviano' },
    { nombre: 'camion_1_eje', numero_ejes: 1, descripcion: 'Camion de 1 eje' },
    { nombre: 'camion_2_ejes', numero_ejes: 2, descripcion: 'Camion de 2 ejes' },
    { nombre: 'camion_3_ejes', numero_ejes: 3, descripcion: 'Camion de 3 ejes' }
  ];

  for (const categoria of categorias) {
    const actual = await prisma.categoriaPeaje.findFirst({
      where: { propietario_id: null, nombre: categoria.nombre }
    });

    if (actual) {
      await prisma.categoriaPeaje.update({
        where: { id: actual.id },
        data: {
          numero_ejes: categoria.numero_ejes,
          descripcion: categoria.descripcion,
          activo: true
        }
      });
    } else {
      await prisma.categoriaPeaje.create({
        data: categoria
      });
    }
  }
};

const seedConfiguraciones = async () => {
  const configuraciones = [
    {
      clave: 'precio_galon_diesel',
      valor: '2',
      descripcion: 'Precio referencial del galon de diesel'
    },
    {
      clave: 'bonificacion_flete_monto_minimo',
      valor: '1200',
      descripcion: 'Total semanal de fletes desde el cual se calcula bonificacion'
    },
    {
      clave: 'bonificacion_flete_monto_tramo',
      valor: '100',
      descripcion: 'Monto de cada tramo de flete para calcular bonificacion semanal'
    },
    {
      clave: 'bonificacion_flete_valor_tramo',
      valor: '5',
      descripcion: 'Valor de bonificacion por cada tramo de flete semanal'
    },
    {
      clave: 'bonificacion_flete_monto_maximo',
      valor: '0',
      descripcion: 'Tope maximo de bonificacion semanal; 0 significa sin tope'
    },
    {
      clave: 'alerta_mantenimiento_km_anticipacion',
      valor: '500',
      descripcion: 'Kilometros de anticipacion para alertar mantenimientos por vencer'
    },
    {
      clave: 'alerta_licencia_dias_anticipacion',
      valor: '90',
      descripcion: 'Dias de anticipacion para alertar licencias por caducar'
    },
    {
      clave: 'alerta_viaje_sin_cobrar_semanas',
      valor: '5',
      descripcion: 'Semanas maximas para alertar viajes pendientes de cobro'
    }
  ];

  for (const configuracion of configuraciones) {
    const actual = await prisma.configuracionOperativa.findFirst({
      where: { propietario_id: null, clave: configuracion.clave }
    });

    if (actual) {
      await prisma.configuracionOperativa.update({
        where: { id: actual.id },
        data: configuracion
      });
    } else {
      await prisma.configuracionOperativa.create({
        data: configuracion
      });
    }
  }
};

const seedTiposMantenimiento = async () => {
  const tipos = [
    {
      nombre: 'cambio_aceite',
      descripcion: 'Cambio periodico de aceite',
      es_periodico: true,
      intervalo_km: 5000,
      intervalo_dias: null
    },
    {
      nombre: 'revision_frenos',
      descripcion: 'Revision del sistema de frenos',
      es_periodico: true,
      intervalo_km: 10000,
      intervalo_dias: null
    },
    {
      nombre: 'alineacion_balanceo',
      descripcion: 'Alineacion y balanceo',
      es_periodico: true,
      intervalo_km: 10000,
      intervalo_dias: null
    },
    {
      nombre: 'correctivo',
      descripcion: 'Mantenimiento correctivo no periodico',
      es_periodico: false,
      intervalo_km: null,
      intervalo_dias: null
    }
  ];

  for (const tipo of tipos) {
    const actual = await prisma.tipoMantenimiento.findFirst({
      where: { propietario_id: null, nombre: tipo.nombre }
    });

    if (actual) {
      await prisma.tipoMantenimiento.update({
        where: { id: actual.id },
        data: { ...tipo, activo: true }
      });
    } else {
      await prisma.tipoMantenimiento.create({
        data: tipo
      });
    }
  }
};

const upsertScopedRuta = async (
  propietarioId: bigint,
  data: {
    origen: string;
    destino: string;
    distancia_km: number;
    duracion_estimada_horas: number;
    activa?: boolean;
  }
) => {
  const actual = await prisma.ruta.findFirst({
    where: {
      propietario_id: propietarioId,
      origen: data.origen,
      destino: data.destino
    }
  });

  if (actual) {
    return prisma.ruta.update({
      where: { id: actual.id },
      data: { ...data, activa: data.activa ?? true }
    });
  }

  return prisma.ruta.create({
    data: {
      propietario_id: propietarioId,
      ...data,
      activa: data.activa ?? true
    }
  });
};

const upsertScopedPeaje = async (
  propietarioId: bigint,
  data: {
    nombre: string;
    ubicacion: string;
    activo?: boolean;
  }
) => {
  const actual = await prisma.peaje.findFirst({
    where: {
      propietario_id: propietarioId,
      nombre: data.nombre
    }
  });

  if (actual) {
    return prisma.peaje.update({
      where: { id: actual.id },
      data: { ...data, activo: data.activo ?? true }
    });
  }

  return prisma.peaje.create({
    data: {
      propietario_id: propietarioId,
      ...data,
      activo: data.activo ?? true
    }
  });
};

const upsertScopedTarifaRuta = async (
  propietarioId: bigint,
  data: {
    ruta_id: bigint;
    tipo_carga_id: bigint;
    capacidad: number;
    toneladas: number;
    precio: number;
    vigente_desde: Date;
    vigente_hasta: Date;
  }
) => {
  const actual = await prisma.tarifaRuta.findFirst({
    where: {
      propietario_id: propietarioId,
      ruta_id: data.ruta_id,
      tipo_carga_id: data.tipo_carga_id,
      capacidad: data.capacidad,
      toneladas: data.toneladas,
      vigente_desde: data.vigente_desde
    }
  });

  if (actual) {
    return prisma.tarifaRuta.update({
      where: { id: actual.id },
      data: {
        toneladas: data.toneladas,
        precio: data.precio,
        vigente_hasta: data.vigente_hasta,
        activa: true
      }
    });
  }

  return prisma.tarifaRuta.create({
    data: {
      propietario_id: propietarioId,
      ...data,
      activa: true
    }
  });
};

const upsertScopedTarifaPeaje = async (
  propietarioId: bigint,
  data: {
    peaje_id: bigint;
    categoria_peaje_id: bigint;
    valor: number;
    vigente_desde: Date;
    vigente_hasta: Date;
  }
) => {
  const actual = await prisma.tarifaPeaje.findFirst({
    where: {
      propietario_id: propietarioId,
      peaje_id: data.peaje_id,
      categoria_peaje_id: data.categoria_peaje_id,
      vigente_desde: data.vigente_desde
    }
  });

  if (actual) {
    return prisma.tarifaPeaje.update({
      where: { id: actual.id },
      data: {
        valor: data.valor,
        vigente_hasta: data.vigente_hasta,
        activa: true
      }
    });
  }

  return prisma.tarifaPeaje.create({
    data: {
      propietario_id: propietarioId,
      ...data,
      activa: true
    }
  });
};

const upsertScopedRutaPeaje = async (
  propietarioId: bigint,
  data: {
    ruta_id: bigint;
    peaje_id: bigint;
    orden: number;
    sentido: SentidoPeaje;
  }
) => {
  const actual = await prisma.rutaPeaje.findFirst({
    where: {
      propietario_id: propietarioId,
      ruta_id: data.ruta_id,
      peaje_id: data.peaje_id,
      sentido: data.sentido
    }
  });

  if (actual) {
    return prisma.rutaPeaje.update({
      where: { id: actual.id },
      data: {
        orden: data.orden
      }
    });
  }

  return prisma.rutaPeaje.create({
    data: {
      propietario_id: propietarioId,
      ...data
    }
  });
};

const upsertScopedViaje = async (
  propietarioId: bigint,
  data: {
    cliente_id: bigint;
    vehiculo_id: bigint;
    conductor_id: bigint;
    tarifa_ruta_id: bigint;
    fecha_salida: Date;
    fecha_llegada: Date;
    descripcion_carga: string;
    peso_carga_kg: number;
    numeros_guia_remision: string[];
    precio_flete: number;
    porcentaje_comision_aplicado: number;
    galones_diesel: number;
    costo_diesel: number;
    costo_peajes: number;
    costo_estimado_gastos: number;
    costo_real_gastos: number;
    cobrado: boolean;
    fecha_cobro: Date | null;
    estado: EstadoViaje;
    observaciones: string;
  }
) => {
  const valorComision = Number(
    ((data.precio_flete * data.porcentaje_comision_aplicado) / 100).toFixed(2)
  );
  const precioRealFlete = Number((data.precio_flete - valorComision).toFixed(2));
  const actual = await prisma.viaje.findFirst({
    where: {
      propietario_id: propietarioId,
      descripcion_carga: data.descripcion_carga
    }
  });

  const payload = {
    ...data,
    propietario_id: propietarioId,
    valor_comision: valorComision,
    precio_real_flete: precioRealFlete
  };

  if (actual) {
    return prisma.viaje.update({
      where: { id: actual.id },
      data: payload
    });
  }

  return prisma.viaje.create({
    data: payload
  });
};

const seedDemoPropietarios = async () => {
  const adminRol = await prisma.rol.findUnique({ where: { nombre: 'admin' } });
  const operadorRol = await prisma.rol.findUnique({ where: { nombre: 'operador' } });
  const categoriaCamion = await prisma.categoriaPeaje.findFirst({
    where: {
      propietario_id: null,
      numero_ejes: 2,
      activo: true
    }
  });
  const tipoCartones = await prisma.tipoCarga.findFirst({
    where: {
      propietario_id: null,
      nombre: 'cartones',
      activo: true
    }
  });
  const tipoPallets = await prisma.tipoCarga.findFirst({
    where: {
      propietario_id: null,
      nombre: 'pallets',
      activo: true
    }
  });
  const tipoMantenimiento = await prisma.tipoMantenimiento.findFirst({
    where: {
      propietario_id: null,
      nombre: 'cambio_aceite',
      activo: true
    }
  });

  if (!adminRol || !operadorRol || !categoriaCamion || !tipoCartones || !tipoPallets || !tipoMantenimiento) {
    throw new Error('Faltan catalogos base para crear datos demo');
  }

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const vigenteDesde = toDateOnly('2026-01-01');
  const vigenteHasta = toDateOnly('2029-01-01');
  const demos = [
    {
      codigo: 1,
      nombre: 'TRANSPORTE ANDINO DEMO',
      ruc: 'DEMO-PROP-001',
      ciudad: 'MACHALA',
      destinos: ['GUAYAQUIL', 'VINCES']
    },
    {
      codigo: 2,
      nombre: 'LOGISTICA COSTA DEMO',
      ruc: 'DEMO-PROP-002',
      ciudad: 'GUAYAQUIL',
      destinos: ['CUENCA', 'MANTA']
    },
    {
      codigo: 3,
      nombre: 'CARGA BANANERA DEMO',
      ruc: 'DEMO-PROP-003',
      ciudad: 'EL GUABO',
      destinos: ['DURAN', 'QUEVEDO']
    },
    {
      codigo: 4,
      nombre: 'FLETES SIERRA DEMO',
      ruc: 'DEMO-PROP-004',
      ciudad: 'CUENCA',
      destinos: ['LOJA', 'AMBATO']
    },
    {
      codigo: 5,
      nombre: 'EXPRESO COMERCIAL DEMO',
      ruc: 'DEMO-PROP-005',
      ciudad: 'MILAGRO',
      destinos: ['NARANJAL', 'PORTOVIEJO']
    }
  ];

  for (const demo of demos) {
    const propietario = await prisma.propietario.upsert({
      where: { ruc_cedula: demo.ruc },
      update: {
        nombre: demo.nombre,
        contacto_nombre: `ADMIN ${demo.codigo}`,
        telefono: `09900000${demo.codigo}`,
        email: `propietario${demo.codigo}@demo.test`,
        direccion: `OFICINA PRINCIPAL ${demo.ciudad}`,
        activo: true
      },
      create: {
        nombre: demo.nombre,
        ruc_cedula: demo.ruc,
        contacto_nombre: `ADMIN ${demo.codigo}`,
        telefono: `09900000${demo.codigo}`,
        email: `propietario${demo.codigo}@demo.test`,
        direccion: `OFICINA PRINCIPAL ${demo.ciudad}`,
        activo: true
      }
    });

    const adminUsuario = await prisma.usuario.upsert({
      where: { email: `propietario${demo.codigo}@demo.test` },
      update: {
        nombre: `ADMIN ${demo.nombre}`,
        password_hash: passwordHash,
        es_super_admin: false,
        email_verificado: true,
        requiere_password: false,
        activo: true
      },
      create: {
        nombre: `ADMIN ${demo.nombre}`,
        email: `propietario${demo.codigo}@demo.test`,
        password_hash: passwordHash,
        es_super_admin: false,
        email_verificado: true,
        requiere_password: false,
        activo: true
      }
    });

    const operadorUsuario = await prisma.usuario.upsert({
      where: { email: `operador${demo.codigo}@demo.test` },
      update: {
        nombre: `OPERADOR ${demo.nombre}`,
        password_hash: passwordHash,
        es_super_admin: false,
        email_verificado: true,
        requiere_password: false,
        activo: true
      },
      create: {
        nombre: `OPERADOR ${demo.nombre}`,
        email: `operador${demo.codigo}@demo.test`,
        password_hash: passwordHash,
        es_super_admin: false,
        email_verificado: true,
        requiere_password: false,
        activo: true
      }
    });

    await prisma.usuarioPropietario.upsert({
      where: {
        usuario_id_propietario_id: {
          usuario_id: adminUsuario.id,
          propietario_id: propietario.id
        }
      },
      update: {
        rol_id: adminRol.id,
        activo: true
      },
      create: {
        usuario_id: adminUsuario.id,
        propietario_id: propietario.id,
        rol_id: adminRol.id,
        activo: true
      }
    });

    await prisma.usuarioPropietario.upsert({
      where: {
        usuario_id_propietario_id: {
          usuario_id: operadorUsuario.id,
          propietario_id: propietario.id
        }
      },
      update: {
        rol_id: operadorRol.id,
        activo: true
      },
      create: {
        usuario_id: operadorUsuario.id,
        propietario_id: propietario.id,
        rol_id: operadorRol.id,
        activo: true
      }
    });

    const clientes = await Promise.all(
      [1, 2, 3].map((item) =>
        prisma.cliente.upsert({
          where: {
            propietario_id_ruc_cedula: {
              propietario_id: propietario.id,
              ruc_cedula: `179${demo.codigo}${item}0000001`
            }
          },
          update: {
            nombre: `CLIENTE ${demo.codigo}-${item}`,
            contacto_nombre: `CONTACTO CLIENTE ${demo.codigo}-${item}`,
            telefono: `098${demo.codigo}${item}00000`,
            email: `cliente${demo.codigo}${item}@demo.test`,
            direccion: `BODEGA CLIENTE ${demo.codigo}-${item}`,
            porcentaje_comision: item,
            activo: true
          },
          create: {
            propietario_id: propietario.id,
            nombre: `CLIENTE ${demo.codigo}-${item}`,
            ruc_cedula: `179${demo.codigo}${item}0000001`,
            contacto_nombre: `CONTACTO CLIENTE ${demo.codigo}-${item}`,
            telefono: `098${demo.codigo}${item}00000`,
            email: `cliente${demo.codigo}${item}@demo.test`,
            direccion: `BODEGA CLIENTE ${demo.codigo}-${item}`,
            porcentaje_comision: item,
            activo: true
          }
        })
      )
    );

    const conductores = await Promise.all(
      [1, 2].map((item) =>
        prisma.conductor.upsert({
          where: {
            propietario_id_cedula: {
              propietario_id: propietario.id,
              cedula: `09${demo.codigo}${item}000001`
            }
          },
          update: {
            nombre: `CONDUCTOR ${demo.codigo}-${item}`,
            fecha_nacimiento: toDateOnly(`198${item}-0${item + 1}-15`),
            numero_licencia: `LIC-DEMO-${demo.codigo}-${item}`,
            fecha_caducidad_licencia: toDateOnly(`202${7 + item}-12-31`),
            telefono: `097${demo.codigo}${item}00000`,
            email: `conductor${demo.codigo}${item}@demo.test`,
            sueldo_semanal: 180 + item * 20,
            estado: 'ACTIVO'
          },
          create: {
            propietario_id: propietario.id,
            nombre: `CONDUCTOR ${demo.codigo}-${item}`,
            cedula: `09${demo.codigo}${item}000001`,
            fecha_nacimiento: toDateOnly(`198${item}-0${item + 1}-15`),
            numero_licencia: `LIC-DEMO-${demo.codigo}-${item}`,
            fecha_caducidad_licencia: toDateOnly(`202${7 + item}-12-31`),
            telefono: `097${demo.codigo}${item}00000`,
            email: `conductor${demo.codigo}${item}@demo.test`,
            sueldo_semanal: 180 + item * 20,
            estado: 'ACTIVO'
          }
        })
      )
    );

    const vehiculos = await Promise.all(
      [1, 2].map((item) =>
        prisma.vehiculo.upsert({
          where: {
            propietario_id_placa: {
              propietario_id: propietario.id,
              placa: `DEM-${demo.codigo}${item}0${item}`
            }
          },
          update: {
            categoria_peaje_id: categoriaCamion.id,
            marca: item === 1 ? 'HINO' : 'ISUZU',
            modelo: item === 1 ? 'GH' : 'FVR',
            color: item === 1 ? 'BLANCO' : 'AZUL',
            anio: 2020 + item,
            capacidad: item === 1 ? 6000 : 7000,
            toneladas: item === 1 ? 10 : 11,
            kilometraje_actual: 45000 + demo.codigo * 1000 + item * 500,
            rendimiento_km_galon: 16,
            estado: 'DISPONIBLE'
          },
          create: {
            propietario_id: propietario.id,
            categoria_peaje_id: categoriaCamion.id,
            placa: `DEM-${demo.codigo}${item}0${item}`,
            marca: item === 1 ? 'HINO' : 'ISUZU',
            modelo: item === 1 ? 'GH' : 'FVR',
            color: item === 1 ? 'BLANCO' : 'AZUL',
            anio: 2020 + item,
            capacidad: item === 1 ? 6000 : 7000,
            toneladas: item === 1 ? 10 : 11,
            kilometraje_actual: 45000 + demo.codigo * 1000 + item * 500,
            rendimiento_km_galon: 16,
            estado: 'DISPONIBLE'
          }
        })
      )
    );

    const rutas = await Promise.all(
      demo.destinos.map((destino, index) =>
        upsertScopedRuta(propietario.id, {
          origen: demo.ciudad,
          destino,
          distancia_km: 120 + demo.codigo * 10 + index * 35,
          duracion_estimada_horas: index === 0 ? 2.5 : 3.75
        })
      )
    );

    const peajes = await Promise.all(
      [1, 2].map((item) =>
        upsertScopedPeaje(propietario.id, {
          nombre: `PEAJE DEMO ${demo.codigo}-${item}`,
          ubicacion: `TRAMO ${demo.ciudad} ${item}`
        })
      )
    );

    await Promise.all(
      peajes.map((peaje, index) =>
        upsertScopedTarifaPeaje(propietario.id, {
          peaje_id: peaje.id,
          categoria_peaje_id: categoriaCamion.id,
          valor: 2 + index + demo.codigo * 0.25,
          vigente_desde: vigenteDesde,
          vigente_hasta: vigenteHasta
        })
      )
    );

    await Promise.all(
      rutas.flatMap((ruta) =>
        peajes.map((peaje, index) =>
          upsertScopedRutaPeaje(propietario.id, {
            ruta_id: ruta.id,
            peaje_id: peaje.id,
            orden: index + 1,
            sentido: SentidoPeaje.AMBOS
          })
        )
      )
    );

    const [rutaPrincipal, rutaSecundaria] = rutas;
    const [clientePrincipal, clienteSecundario] = clientes;
    const [vehiculoPrincipal, vehiculoSecundario] = vehiculos;
    const [conductorPrincipal, conductorSecundario] = conductores;

    if (
      !rutaPrincipal ||
      !rutaSecundaria ||
      !clientePrincipal ||
      !clienteSecundario ||
      !vehiculoPrincipal ||
      !vehiculoSecundario ||
      !conductorPrincipal ||
      !conductorSecundario
    ) {
      throw new Error(`Datos demo incompletos para ${demo.nombre}`);
    }

    const tarifas = await Promise.all([
      upsertScopedTarifaRuta(propietario.id, {
        ruta_id: rutaPrincipal.id,
        tipo_carga_id: tipoCartones.id,
        capacidad: 6000,
        toneladas: 10,
        precio: 300 + demo.codigo * 15,
        vigente_desde: vigenteDesde,
        vigente_hasta: vigenteHasta
      }),
      upsertScopedTarifaRuta(propietario.id, {
        ruta_id: rutaSecundaria.id,
        tipo_carga_id: tipoPallets.id,
        capacidad: 7000,
        toneladas: 11,
        precio: 350 + demo.codigo * 15,
        vigente_desde: vigenteDesde,
        vigente_hasta: vigenteHasta
      })
    ]);

    const [tarifaPrincipal, tarifaSecundaria] = tarifas;

    if (!tarifaPrincipal || !tarifaSecundaria) {
      throw new Error(`Tarifas demo incompletas para ${demo.nombre}`);
    }

    await Promise.all([
      upsertScopedViaje(propietario.id, {
        cliente_id: clientePrincipal.id,
        vehiculo_id: vehiculoPrincipal.id,
        conductor_id: conductorPrincipal.id,
        tarifa_ruta_id: tarifaPrincipal.id,
        fecha_salida: toDateOnly('2026-05-04'),
        fecha_llegada: toDateOnly('2026-05-04'),
        descripcion_carga: `VIAJE DEMO ${demo.codigo}-1 CARTONES`,
        peso_carga_kg: 9800,
        numeros_guia_remision: [`GDEMO-${demo.codigo}-001`, `GDEMO-${demo.codigo}-002`],
        precio_flete: 300 + demo.codigo * 15,
        porcentaje_comision_aplicado: Number(clientePrincipal.porcentaje_comision),
        galones_diesel: 8,
        costo_diesel: 16,
        costo_peajes: 6,
        costo_estimado_gastos: 42,
        costo_real_gastos: 50,
        cobrado: demo.codigo % 2 === 0,
        fecha_cobro: demo.codigo % 2 === 0 ? toDateOnly('2026-05-08') : null,
        estado: EstadoViaje.COMPLETADO,
        observaciones: `DATO DEMO PROPIETARIO ${demo.codigo}`
      }),
      upsertScopedViaje(propietario.id, {
        cliente_id: clienteSecundario.id,
        vehiculo_id: vehiculoSecundario.id,
        conductor_id: conductorSecundario.id,
        tarifa_ruta_id: tarifaSecundaria.id,
        fecha_salida: toDateOnly('2026-05-11'),
        fecha_llegada: toDateOnly('2026-05-12'),
        descripcion_carga: `VIAJE DEMO ${demo.codigo}-2 PALLETS`,
        peso_carga_kg: 11000,
        numeros_guia_remision: [`GDEMO-${demo.codigo}-003`],
        precio_flete: 350 + demo.codigo * 15,
        porcentaje_comision_aplicado: Number(clienteSecundario.porcentaje_comision),
        galones_diesel: 10,
        costo_diesel: 20,
        costo_peajes: 8,
        costo_estimado_gastos: 55,
        costo_real_gastos: 65,
        cobrado: false,
        fecha_cobro: null,
        estado: EstadoViaje.COMPLETADO,
        observaciones: `DATO DEMO PROPIETARIO ${demo.codigo}`
      })
    ]);

    const mantenimientoActual = await prisma.mantenimiento.findFirst({
      where: {
        propietario_id: propietario.id,
        vehiculo_id: vehiculoPrincipal.id,
        descripcion: `MANTENIMIENTO DEMO ${demo.codigo}`
      }
    });
    const mantenimientoPayload = {
      propietario_id: propietario.id,
      vehiculo_id: vehiculoPrincipal.id,
      tipo_mantenimiento_id: tipoMantenimiento.id,
      fecha_mantenimiento: toDateOnly('2026-05-15'),
      kilometraje_actual_vehiculo: 47000 + demo.codigo * 1000,
      descripcion: `MANTENIMIENTO DEMO ${demo.codigo}`,
      costo_mano_obra: 35,
      costo_repuestos: 65,
      costo_total: 100,
      proximo_mantenimiento_km: 52000 + demo.codigo * 1000,
      proximo_mantenimiento_fecha: toDateOnly('2026-08-15'),
      estado: EstadoMantenimiento.REALIZADO
    };

    const mantenimiento = mantenimientoActual
      ? await prisma.mantenimiento.update({
          where: { id: mantenimientoActual.id },
          data: mantenimientoPayload
        })
      : await prisma.mantenimiento.create({
          data: mantenimientoPayload
        });

    const repuestoActual = await prisma.repuestoMantenimiento.findFirst({
      where: {
        mantenimiento_id: mantenimiento.id,
        nombre_repuesto: `FILTRO ACEITE DEMO ${demo.codigo}`
      }
    });

    if (repuestoActual) {
      await prisma.repuestoMantenimiento.update({
        where: { id: repuestoActual.id },
        data: {
          cantidad: 1,
          costo_unitario: 25,
          costo_total: 25
        }
      });
    } else {
      await prisma.repuestoMantenimiento.create({
        data: {
          mantenimiento_id: mantenimiento.id,
          nombre_repuesto: `FILTRO ACEITE DEMO ${demo.codigo}`,
          cantidad: 1,
          costo_unitario: 25,
          costo_total: 25
        }
      });
    }
  }
};

const main = async () => {
  await seedRoles();
  await seedSuperAdmin();
  await seedTiposCarga();
  await seedTiposGastoViaje();
  await seedCategoriasPeaje();
  await seedConfiguraciones();
  await seedTiposMantenimiento();
  await seedDemoPropietarios();
};

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed completado');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
