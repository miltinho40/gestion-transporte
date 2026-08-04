export interface MenuPermission {
  key: string;
  label: string;
  group: string;
  requiresOwnFleet?: boolean;
  requiresIntermediary?: boolean;
  adminOnly?: boolean;
}

export const MENU_PERMISSIONS: MenuPermission[] = [
  { key: 'asistente', label: 'Asistente', group: 'General' },
  { key: 'dashboard', label: 'Alertas', group: 'General' },
  { key: 'clientes', label: 'Clientes', group: 'General' },
  { key: 'viajes', label: 'Viajes', group: 'Transporte', requiresOwnFleet: true },
  { key: 'cierre_semanal', label: 'Cierre semanal', group: 'Transporte', requiresOwnFleet: true },
  { key: 'reporte_viajes', label: 'Reporte de viajes', group: 'Transporte', requiresOwnFleet: true },
  { key: 'utilidad', label: 'Utilidad', group: 'Transporte', requiresOwnFleet: true },
  { key: 'vehiculos', label: 'Vehículos', group: 'Transporte', requiresOwnFleet: true },
  { key: 'conductores', label: 'Conductores', group: 'Transporte', requiresOwnFleet: true },
  { key: 'rutas', label: 'Destinos', group: 'Transporte' },
  { key: 'tarifas_ruta', label: 'Precios', group: 'Transporte' },
  { key: 'tipos_carga', label: 'Tipo de carga', group: 'Transporte' },
  { key: 'proveedores', label: 'Proveedores', group: 'Proveedores', requiresIntermediary: true },
  {
    key: 'proveedor_viajes',
    label: 'Viaje Proveedores',
    group: 'Proveedores',
    requiresIntermediary: true
  },
  {
    key: 'proveedor_resumen',
    label: 'Resumen proveedores',
    group: 'Proveedores',
    requiresIntermediary: true
  },
  {
    key: 'tipos_mantenimiento',
    label: 'Tipos de mantenimiento',
    group: 'Mantenimiento',
    requiresOwnFleet: true
  },
  {
    key: 'mantenimientos',
    label: 'Mantenimientos',
    group: 'Mantenimiento',
    requiresOwnFleet: true
  },
  { key: 'configuraciones', label: 'Configuraciones', group: 'Cuenta', requiresOwnFleet: true, adminOnly: true }
];

export const groupedMenuPermissions = () => {
  return MENU_PERMISSIONS.reduce<Record<string, MenuPermission[]>>((groups, permission) => {
    groups[permission.group] = [...(groups[permission.group] ?? []), permission];
    return groups;
  }, {});
};
