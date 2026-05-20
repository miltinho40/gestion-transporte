import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
      activo: true
    },
    create: {
      nombre: 'Administrador',
      email: 'admin@local.test',
      password_hash,
      es_super_admin: true
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
    await prisma.tipoCarga.upsert({
      where: { nombre: tipo.nombre },
      update: { descripcion: tipo.descripcion, activo: true },
      create: tipo
    });
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
      valor: '0',
      descripcion: 'Precio referencial del galon de diesel'
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

const main = async () => {
  await seedRoles();
  await seedSuperAdmin();
  await seedTiposCarga();
  await seedTiposGastoViaje();
  await seedCategoriasPeaje();
  await seedConfiguraciones();
  await seedTiposMantenimiento();
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
