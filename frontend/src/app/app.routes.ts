import { Routes } from '@angular/router';
import { intermediarioGuard, propietarioGuard, superAdminGuard } from './core/admin.guard';
import { authGuard } from './core/auth.guard';
import { AppShellComponent } from './layout/app-shell.component';
import { MobileShellComponent } from './layout/mobile-shell.component';

const loadAcceptInvitationPage = () =>
  import('./pages/accept-invitation/accept-invitation-page.component').then(
    (m) => m.AcceptInvitationPageComponent
  );
const loadAsistentePage = () =>
  import('./pages/asistente/asistente-page.component').then((m) => m.AsistentePageComponent);
const loadAsistenteEvaluacionesPage = () =>
  import('./pages/asistente-evaluaciones/asistente-evaluaciones-page.component').then(
    (m) => m.AsistenteEvaluacionesPageComponent
  );
const loadChangePasswordPage = () =>
  import('./pages/change-password/change-password-page.component').then(
    (m) => m.ChangePasswordPageComponent
  );
const loadCrudPage = () => import('./pages/crud/crud-page.component').then((m) => m.CrudPageComponent);
const loadDashboardPage = () =>
  import('./pages/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent);
const loadLoginPage = () => import('./pages/login/login-page.component').then((m) => m.LoginPageComponent);
const loadMantenimientosPage = () =>
  import('./pages/mantenimientos/mantenimientos-page.component').then(
    (m) => m.MantenimientosPageComponent
  );
const loadPeajesPage = () => import('./pages/peajes/peajes-page.component').then((m) => m.PeajesPageComponent);
const loadProveedorTransportePage = () =>
  import('./pages/proveedor-transporte/proveedor-transporte-page.component').then(
    (m) => m.ProveedorTransportePageComponent
  );
const loadProveedorResumenPage = () =>
  import('./pages/proveedor-resumen/proveedor-resumen-page.component').then(
    (m) => m.ProveedorResumenPageComponent
  );
const loadReportsPage = () =>
  import('./pages/reports/reports-page.component').then((m) => m.ReportsPageComponent);
const loadRolesPermissionsPage = () =>
  import('./pages/roles-permissions/roles-permissions-page.component').then(
    (m) => m.RolesPermissionsPageComponent
  );
const loadRutasPage = () => import('./pages/rutas/rutas-page.component').then((m) => m.RutasPageComponent);
const loadUtilityReportPage = () =>
  import('./pages/utility-report/utility-report-page.component').then(
    (m) => m.UtilityReportPageComponent
  );
const loadWeeklyClosurePage = () =>
  import('./pages/weekly-closure/weekly-closure-page.component').then(
    (m) => m.WeeklyClosurePageComponent
  );

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const todayInputDate = () => toDateInputValue(new Date());

const yearsFromTodayInputDate = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);

  return toDateInputValue(date);
};

export const routes: Routes = [
  { path: 'login', loadComponent: loadLoginPage },
  { path: 'aceptar-invitacion', loadComponent: loadAcceptInvitationPage },
  {
    path: 'movil',
    component: MobileShellComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: 'asistente',
        loadComponent: loadAsistentePage
      },
      {
        path: 'viajes',
        canActivate: [propietarioGuard],
        loadComponent: () =>
          import('./pages/mobile-viajes/mobile-viajes-page.component').then((m) => m.MobileViajesPageComponent)
      },
      {
        path: 'viajes/nuevo',
        canActivate: [propietarioGuard],
        loadComponent: () =>
          import('./pages/mobile-viajes/mobile-viaje-form-page.component').then((m) => m.MobileViajeFormPageComponent)
      },
      {
        path: 'viajes/:id/editar',
        canActivate: [propietarioGuard],
        loadComponent: () =>
          import('./pages/mobile-viajes/mobile-viaje-form-page.component').then((m) => m.MobileViajeFormPageComponent)
      },
      {
        path: 'viajes-proveedores',
        canActivate: [intermediarioGuard],
        loadComponent: () =>
          import('./pages/mobile-proveedor-viajes/mobile-proveedor-viajes-page.component').then(
            (m) => m.MobileProveedorViajesPageComponent
          )
      },
      {
        path: 'viajes-proveedores/nuevo',
        canActivate: [intermediarioGuard],
        loadComponent: () =>
          import('./pages/mobile-proveedor-viajes/mobile-proveedor-viaje-form-page.component').then(
            (m) => m.MobileProveedorViajeFormPageComponent
          )
      },
      {
        path: 'viajes-proveedores/:id/editar',
        canActivate: [intermediarioGuard],
        loadComponent: () =>
          import('./pages/mobile-proveedor-viajes/mobile-proveedor-viaje-form-page.component').then(
            (m) => m.MobileProveedorViajeFormPageComponent
          )
      },
      {
        path: 'mantenimientos',
        canActivate: [propietarioGuard],
        loadComponent: () =>
          import('./pages/mobile-mantenimientos/mobile-mantenimientos-page.component').then(
            (m) => m.MobileMantenimientosPageComponent
          )
      },
      {
        path: 'mantenimientos/nuevo',
        canActivate: [propietarioGuard],
        loadComponent: () =>
          import('./pages/mobile-mantenimientos/mobile-mantenimiento-form-page.component').then(
            (m) => m.MobileMantenimientoFormPageComponent
          )
      },
      {
        path: 'mantenimientos/:id/editar',
        canActivate: [propietarioGuard],
        loadComponent: () =>
          import('./pages/mobile-mantenimientos/mobile-mantenimiento-form-page.component').then(
            (m) => m.MobileMantenimientoFormPageComponent
          )
      },
      {
        path: 'cierre-semanal',
        canActivate: [propietarioGuard],
        loadComponent: () =>
          import('./pages/mobile-weekly-closure/mobile-weekly-closure-page.component').then(
            (m) => m.MobileWeeklyClosurePageComponent
          )
      },
      {
        path: 'precios',
        loadComponent: () =>
          import('./pages/mobile-precios/mobile-precios-page.component').then((m) => m.MobilePreciosPageComponent)
      },
      {
        path: 'precios/nuevo',
        loadComponent: () =>
          import('./pages/mobile-precios/mobile-precio-form-page.component').then((m) => m.MobilePrecioFormPageComponent)
      },
      {
        path: 'precios/:id/editar',
        loadComponent: () =>
          import('./pages/mobile-precios/mobile-precio-form-page.component').then((m) => m.MobilePrecioFormPageComponent)
      },
      { path: '', pathMatch: 'full', redirectTo: 'viajes' }
    ]
  },
  {
    path: 'app',
    component: AppShellComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: 'asistente', loadComponent: loadAsistentePage },
      {
        path: 'asistente/evaluaciones',
        canActivate: [superAdminGuard],
        loadComponent: loadAsistenteEvaluacionesPage
      },
      { path: 'dashboard', loadComponent: loadDashboardPage },
      { path: 'cambiar-clave', loadComponent: loadChangePasswordPage },
      {
        path: 'propietarios',
        loadComponent: loadCrudPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'Propietarios',
          description: 'Propietarios del sistema y datos principales de contacto.',
          endpoint: '/propietarios',
          displayField: 'nombre',
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'RUC/Cédula', path: 'ruc_cedula' },
            { label: 'Contacto', path: 'contacto_nombre' },
            { label: 'Teléfono', path: 'telefono' },
            { label: 'Email', path: 'email' },
            { label: 'Suscripción', path: 'estado_suscripcion', type: 'badge' },
            { label: 'Vehículos', path: 'uso_vehiculos' },
            { label: 'Precio vehículo', path: 'precio_por_vehiculo', type: 'money' },
            { label: 'Total mensual', path: 'total_mensual_estimado', type: 'money' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'ruc_cedula', label: 'RUC/Cédula', type: 'text', required: true, colClass: 'col-md-3' },
            { name: 'telefono', label: 'Teléfono', type: 'text', colClass: 'col-md-3' },
            { name: 'contacto_nombre', label: 'Contacto', type: 'text', colClass: 'col-md-6' },
            { name: 'email', label: 'Email', type: 'email', colClass: 'col-md-6' },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            {
              name: 'estado_suscripcion',
              label: 'Suscripción',
              type: 'select',
              defaultValue: 'activa',
              colClass: 'col-md-3',
              options: [
                { label: 'Activa', value: 'activa' },
                { label: 'Prueba', value: 'prueba' },
                { label: 'Suspendida', value: 'suspendida' },
                { label: 'Cancelada', value: 'cancelada' }
              ]
            },
            {
              name: 'limite_vehiculos',
              label: 'Límite vehículos',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: 1,
              colClass: 'col-md-3'
            },
            {
              name: 'precio_por_vehiculo',
              label: 'Precio por vehículo',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: '0.01',
              colClass: 'col-md-3'
            },
            {
              name: 'fecha_corte_facturacion',
              label: 'Día de corte',
              type: 'number',
              defaultValue: 1,
              min: 1,
              max: 31,
              step: 1,
              colClass: 'col-md-3'
            },
            { name: 'direccion', label: 'Dirección', type: 'textarea', rows: 2, colClass: 'col-12' },
            {
              name: 'observaciones_facturacion',
              label: 'Observaciones facturación',
              type: 'textarea',
              rows: 2,
              colClass: 'col-12'
            },
            {
              name: 'admin_nombre',
              label: 'Nombre administrador',
              type: 'text',
              required: true,
              createOnly: true,
              payloadPath: 'admin.nombre',
              syncFrom: 'nombre',
              colClass: 'col-md-6'
            },
            {
              name: 'admin_email',
              label: 'Email administrador',
              type: 'email',
              required: true,
              createOnly: true,
              payloadPath: 'admin.email',
              syncFrom: 'email',
              colClass: 'col-md-6'
            },
            {
              name: 'admin_fecha_nacimiento',
              label: 'Fecha de nacimiento admin',
              type: 'date',
              createOnly: true,
              payloadPath: 'admin.fecha_nacimiento',
              colClass: 'col-md-4'
            }
          ]
        }
      },
      {
        path: 'usuarios',
        loadComponent: loadCrudPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'Usuarios',
          description: 'Accesos del sistema administrados por el superadmin.',
          endpoint: '/usuarios',
          displayField: 'nombre',
          passwordResetEnabled: true,
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'Email', path: 'email' },
            { label: 'Superadmin', path: 'es_super_admin', type: 'boolean' },
            { label: 'Cambiar clave', path: 'requiere_password', type: 'boolean' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'email', label: 'Email', type: 'email', required: true, colClass: 'col-md-6' },
            { name: 'fecha_nacimiento', label: 'Fecha nacimiento', type: 'date', colClass: 'col-md-4' },
            { name: 'es_super_admin', label: 'Superadmin', type: 'checkbox', defaultValue: false, colClass: 'col-md-2' },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-2' }
          ]
        }
      },
      {
        path: 'usuarios-propietarios',
        loadComponent: loadCrudPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'Asignaciones',
          description: 'Usuarios asignados a propietarios y roles de acceso.',
          endpoint: '/usuarios-propietarios',
          displayField: 'usuario.nombre',
          columns: [
            { label: 'Usuario', path: 'usuario.nombre' },
            { label: 'Email', path: 'usuario.email' },
            { label: 'Propietario', path: 'propietario.nombre' },
            { label: 'Rol', path: 'rol.nombre', type: 'badge' },
            { label: 'Flota propia', path: 'es_propietario', type: 'boolean' },
            { label: 'Intermediario', path: 'es_intermediario', type: 'boolean' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            {
              name: 'usuario_id',
              label: 'Usuario',
              type: 'select',
              required: true,
              createOnly: true,
              colClass: 'col-md-6',
              catalog: {
                endpoint: '/usuarios',
                valuePath: 'id',
                labelPath: 'nombre',
                labelPaths: ['nombre', 'email'],
                params: { activo: true }
              }
            },
            {
              name: 'propietario_id',
              label: 'Propietario',
              type: 'select',
              required: true,
              createOnly: true,
              colClass: 'col-md-6',
              catalog: {
                endpoint: '/propietarios',
                valuePath: 'id',
                labelPath: 'nombre',
                labelPaths: ['nombre', 'ruc_cedula'],
                params: { activo: true }
              }
            },
            {
              name: 'rol_id',
              label: 'Rol',
              type: 'select',
              required: true,
              colClass: 'col-md-6',
              catalog: {
                endpoint: '/roles',
                valuePath: 'id',
                labelPath: 'nombre'
              }
            },
            {
              name: 'es_propietario',
              label: 'Gestiona flota propia',
              type: 'checkbox',
              defaultValue: true,
              colClass: 'col-md-3'
            },
            {
              name: 'es_intermediario',
              label: 'Intermediario',
              type: 'checkbox',
              defaultValue: false,
              colClass: 'col-md-3'
            },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' }
          ]
        }
      },
      {
        path: 'roles',
        loadComponent: loadRolesPermissionsPage,
        canActivate: [superAdminGuard]
      },
      {
        path: 'planes',
        loadComponent: loadCrudPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'Planes y suscripciones',
          description: 'Control de límite de vehículos, precio por vehículo y estado de cobro.',
          endpoint: '/propietarios',
          displayField: 'nombre',
          createEnabled: false,
          deleteEnabled: false,
          columns: [
            { label: 'Propietario', path: 'nombre' },
            { label: 'Suscripción', path: 'estado_suscripcion', type: 'badge' },
            { label: 'Vehículos', path: 'uso_vehiculos' },
            { label: 'Facturables', path: 'vehiculos_facturables' },
            { label: 'Precio vehículo', path: 'precio_por_vehiculo', type: 'money' },
            { label: 'Total mensual', path: 'total_mensual_estimado', type: 'money' },
            { label: 'Día corte', path: 'fecha_corte_facturacion' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            {
              name: 'estado_suscripcion',
              label: 'Suscripción',
              type: 'select',
              required: true,
              colClass: 'col-md-4',
              options: [
                { label: 'Activa', value: 'activa' },
                { label: 'Prueba', value: 'prueba' },
                { label: 'Suspendida', value: 'suspendida' },
                { label: 'Cancelada', value: 'cancelada' }
              ]
            },
            {
              name: 'limite_vehiculos',
              label: 'Límite vehículos',
              type: 'number',
              min: 0,
              step: 1,
              colClass: 'col-md-4'
            },
            {
              name: 'precio_por_vehiculo',
              label: 'Precio por vehículo',
              type: 'number',
              min: 0,
              step: '0.01',
              colClass: 'col-md-4'
            },
            {
              name: 'fecha_corte_facturacion',
              label: 'Día de corte',
              type: 'number',
              min: 1,
              max: 31,
              step: 1,
              colClass: 'col-md-4'
            },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-4' },
            {
              name: 'observaciones_facturacion',
              label: 'Observaciones facturación',
              type: 'textarea',
              rows: 2,
              colClass: 'col-12'
            }
          ]
        }
      },
      {
        path: 'configuracion-diesel',
        loadComponent: loadCrudPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'Configuración diésel',
          description: 'Precio global del galón de diésel definido solo por el superadmin.',
          endpoint: '/configuraciones/superadmin',
          displayField: 'nombre',
          createEnabled: false,
          deleteEnabled: false,
          columns: [
            { label: 'Configuración', path: 'nombre' },
            { label: 'Clave', path: 'clave' },
            { label: 'Valor', path: 'valor' },
            { label: 'Descripción', path: 'descripcion' }
          ],
          fields: [
            {
              name: 'valor',
              label: 'Precio galón diésel',
              type: 'number',
              required: true,
              min: 0,
              step: '0.01',
              colClass: 'col-md-4'
            },
            {
              name: 'descripcion',
              label: 'Descripción',
              type: 'textarea',
              rows: 2,
              colClass: 'col-12'
            }
          ]
        }
      },
      {
        path: 'configuraciones',
        loadComponent: loadCrudPage,
        data: {
          title: 'Configuraciones',
          description: 'Parámetros propios del propietario para bonos y alertas.',
          endpoint: '/configuraciones',
          displayField: 'nombre',
          createEnabled: false,
          deleteEnabled: false,
          columns: [
            { label: 'Configuración', path: 'nombre' },
            { label: 'Clave', path: 'clave' },
            { label: 'Valor', path: 'valor' },
            { label: 'Origen', path: 'origen', type: 'badge' },
            { label: 'Descripción', path: 'descripcion' }
          ],
          fields: [
            {
              name: 'valor',
              label: 'Valor',
              type: 'number',
              required: true,
              min: 0,
              step: '0.01',
              colClass: 'col-md-4'
            },
            {
              name: 'descripcion',
              label: 'Descripción',
              type: 'textarea',
              rows: 2,
              colClass: 'col-12'
            }
          ]
        }
      },
      {
        path: 'clientes',
        loadComponent: loadCrudPage,
        data: {
          title: 'Clientes',
          description: 'Clientes activos, comisión y datos de contacto.',
          endpoint: '/clientes',
          displayField: 'nombre',
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'Propietario', path: 'propietario.nombre', superAdminOnly: true },
            { label: 'RUC/Cédula', path: 'ruc_cedula' },
            { label: 'Teléfono', path: 'telefono' },
            { label: 'Comisión %', path: 'porcentaje_comision' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'ruc_cedula', label: 'RUC/Cédula', type: 'text', required: true, colClass: 'col-md-3' },
            { name: 'telefono', label: 'Teléfono', type: 'text', colClass: 'col-md-3' },
            { name: 'contacto_nombre', label: 'Contacto', type: 'text', colClass: 'col-md-6' },
            { name: 'email', label: 'Email', type: 'email', colClass: 'col-md-6' },
            {
              name: 'porcentaje_comision',
              label: 'Comisión %',
              type: 'number',
              defaultValue: 0,
              min: 0,
              max: 100,
              step: '0.01',
              colClass: 'col-md-3'
            },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            { name: 'direccion', label: 'Dirección', type: 'textarea', rows: 2, colClass: 'col-12' }
          ]
        }
      },
      {
        path: 'conductores',
        loadComponent: loadCrudPage,
        data: {
          title: 'Conductores',
          description: 'Conductores, licencias, teléfono obligatorio y sueldo semanal.',
          endpoint: '/conductores',
          displayField: 'nombre',
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'Propietario', path: 'propietario.nombre', superAdminOnly: true },
            { label: 'Cédula', path: 'cedula' },
            { label: 'Teléfono', path: 'telefono' },
            { label: 'Sueldo semanal', path: 'sueldo_semanal', type: 'money' },
            { label: 'Caduca licencia', path: 'fecha_caducidad_licencia', type: 'date' },
            { label: 'Estado', path: 'estado', type: 'badge' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'cedula', label: 'Cédula', type: 'text', required: true, colClass: 'col-md-3' },
            { name: 'telefono', label: 'Teléfono', type: 'text', required: true, colClass: 'col-md-3' },
            { name: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date', colClass: 'col-md-4' },
            {
              name: 'numero_licencia',
              label: 'Número de licencia',
              type: 'text',
              required: true,
              colClass: 'col-md-4'
            },
            {
              name: 'fecha_caducidad_licencia',
              label: 'Caducidad de licencia',
              type: 'date',
              required: true,
              colClass: 'col-md-4'
            },
            { name: 'email', label: 'Email', type: 'email', colClass: 'col-md-4' },
            {
              name: 'sueldo_semanal',
              label: 'Sueldo semanal',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: '0.01',
              colClass: 'col-md-4'
            },
            {
              name: 'estado',
              label: 'Estado',
              type: 'select',
              required: true,
              defaultValue: 'activo',
              colClass: 'col-md-4',
              options: [
                { label: 'Activo', value: 'activo' },
                { label: 'Inactivo', value: 'inactivo' },
                { label: 'Licencia vencida', value: 'licencia_vencida' }
              ]
            }
          ]
        }
      },
      {
        path: 'vehiculos',
        loadComponent: loadCrudPage,
        data: {
          title: 'Vehículos',
          description: 'Flota, capacidad, tonelaje, rendimiento y kilometraje actual.',
          endpoint: '/vehiculos',
          displayField: 'placa',
          columns: [
            { label: 'Placa', path: 'placa' },
            { label: 'Propietario', path: 'propietario.nombre', superAdminOnly: true },
            { label: 'Marca', path: 'marca' },
            { label: 'Modelo', path: 'modelo' },
            { label: 'Categoría de peaje', path: 'categoria_peaje.nombre' },
            { label: 'Capacidad', path: 'capacidad' },
            { label: 'Toneladas', path: 'toneladas' },
            { label: 'Km actual', path: 'kilometraje_actual' },
            { label: 'Estado', path: 'estado', type: 'badge' },
            { label: 'Facturable', path: 'facturable', type: 'boolean' }
          ],
          fields: [
            {
              name: 'categoria_peaje_id',
              label: 'Categoría de peaje',
              type: 'select',
              required: true,
              colClass: 'col-md-4',
              catalog: {
                endpoint: '/categorias-peaje/catalogo',
                valuePath: 'id',
                labelPath: 'nombre',
                params: { activo: true }
              }
            },
            { name: 'placa', label: 'Placa', type: 'text', required: true, colClass: 'col-md-4' },
            { name: 'marca', label: 'Marca', type: 'text', required: true, colClass: 'col-md-4' },
            { name: 'modelo', label: 'Modelo', type: 'text', colClass: 'col-md-4' },
            { name: 'color', label: 'Color', type: 'text', colClass: 'col-md-4' },
            { name: 'anio', label: 'Año', type: 'number', min: 1900, max: 2100, colClass: 'col-md-4' },
            {
              name: 'capacidad',
              label: 'Capacidad cartones',
              type: 'number',
              required: true,
              min: 1,
              step: 1,
              colClass: 'col-md-4'
            },
            {
              name: 'toneladas',
              label: 'Toneladas',
              type: 'number',
              required: true,
              min: 0,
              step: '0.01',
              colClass: 'col-md-4'
            },
            {
              name: 'kilometraje_actual',
              label: 'Kilometraje actual',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: 1,
              colClass: 'col-md-4'
            },
            {
              name: 'rendimiento_km_galon',
              label: 'Rendimiento km/galón',
              type: 'number',
              required: true,
              defaultValue: 16,
              min: 0,
              step: '0.01',
              colClass: 'col-md-4'
            },
            {
              name: 'estado',
              label: 'Estado',
              type: 'select',
              required: true,
              defaultValue: 'disponible',
              colClass: 'col-md-4',
              options: [
                { label: 'Disponible', value: 'disponible' },
                { label: 'En viaje', value: 'en_viaje' },
                { label: 'En mantenimiento', value: 'en_mantenimiento' },
                { label: 'Inactivo', value: 'inactivo' }
              ]
            },
            { name: 'facturable', label: 'Facturable', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            { name: 'fecha_alta_facturacion', label: 'Alta facturación', type: 'date', colClass: 'col-md-3' },
            { name: 'fecha_baja_facturacion', label: 'Baja facturación', type: 'date', colClass: 'col-md-3' }
          ]
        }
      },
      {
        path: 'categorias-peaje',
        loadComponent: loadCrudPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'Categorías de peaje',
          description: 'Categorías usadas para clasificar vehículos y calcular tarifas de peaje.',
          endpoint: '/categorias-peaje',
          displayField: 'nombre',
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'Número de ejes', path: 'numero_ejes' },
            { label: 'Descripción', path: 'descripcion' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            {
              name: 'numero_ejes',
              label: 'Número de ejes',
              type: 'number',
              min: 0,
              step: 1,
              colClass: 'col-md-3'
            },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            { name: 'global', label: 'Registro global', type: 'checkbox', defaultValue: false, colClass: 'col-md-3' },
            { name: 'descripcion', label: 'Descripción', type: 'textarea', rows: 2, colClass: 'col-12' }
          ]
        }
      },
      {
        path: 'viajes',
        redirectTo: 'reportes',
        pathMatch: 'full',
        data: {
          title: 'Viajes',
          description: 'Viajes, fletes, gastos y estado de cobro.',
          endpoint: '/viajes',
          displayField: 'descripcion_carga',
          columns: [
            { label: 'Fecha', path: 'fecha_salida', type: 'date' },
            { label: 'Cliente', path: 'cliente.nombre' },
            { label: 'Vehículo', path: 'vehiculo.placa' },
            { label: 'Conductor', path: 'conductor.nombre' },
            { label: 'Destino', path: 'tarifa_ruta.ruta.destino' },
            { label: 'Flete', path: 'precio_flete', type: 'money' },
            { label: 'Flete real', path: 'precio_real_flete', type: 'money' },
            { label: 'Cobrado', path: 'cobrado', type: 'boolean' },
            { label: 'Estado', path: 'estado', type: 'badge' }
          ],
          fields: [
            {
              name: 'cliente_id',
              label: 'Cliente',
              type: 'select',
              required: true,
              colClass: 'col-md-4',
              catalog: {
                endpoint: '/clientes',
                valuePath: 'id',
                labelPath: 'nombre',
                labelPaths: ['nombre', 'ruc_cedula'],
                params: { activo: true }
              }
            },
            {
              name: 'vehiculo_id',
              label: 'Vehículo',
              type: 'select',
              required: true,
              colClass: 'col-md-4',
              catalog: {
                endpoint: '/vehiculos',
                valuePath: 'id',
                labelPath: 'placa',
                labelPaths: ['placa', 'marca']
              }
            },
            {
              name: 'conductor_id',
              label: 'Conductor',
              type: 'select',
              required: true,
              colClass: 'col-md-4',
              catalog: {
                endpoint: '/conductores',
                valuePath: 'id',
                labelPath: 'nombre',
                labelPaths: ['nombre', 'cedula'],
                params: { estado: 'activo' }
              }
            },
            {
              name: 'tarifa_ruta_id',
              label: 'Tarifa Ruta',
              type: 'select',
              required: true,
              colClass: 'col-md-6',
              catalog: {
                endpoint: '/tarifas-ruta',
                valuePath: 'id',
                labelPath: 'precio',
                labelPaths: ['ruta.origen', 'ruta.destino', 'tipo_carga.nombre', 'capacidad', 'precio'],
                params: { activa: true, solo_propios: true }
              }
            },
            {
              name: 'fecha_salida',
              label: 'Fecha salida',
              type: 'date',
              defaultValue: todayInputDate,
              colClass: 'col-md-3'
            },
            { name: 'fecha_llegada', label: 'Fecha llegada', type: 'date', colClass: 'col-md-3' },
            {
              name: 'descripcion_carga',
              label: 'Descripción carga',
              type: 'textarea',
              rows: 2,
              colClass: 'col-md-6'
            },
            {
              name: 'numeros_guia_remision',
              label: 'Guías de remisión',
              type: 'textarea',
              rows: 2,
              parseAs: 'stringArray',
              colClass: 'col-md-6'
            },
            {
              name: 'peso_carga_kg',
              label: 'Peso carga kg',
              type: 'number',
              min: 0.01,
              step: '0.01',
              colClass: 'col-md-3'
            },
            {
              name: 'precio_flete',
              label: 'Precio flete',
              type: 'number',
              min: 0.01,
              step: '0.01',
              omitWhenEmpty: true,
              colClass: 'col-md-3'
            },
            {
              name: 'galones_diesel',
              label: 'Galones diésel',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: '0.01',
              colClass: 'col-md-3'
            },
            {
              name: 'costo_diesel',
              label: 'Costo diésel',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: '0.01',
              colClass: 'col-md-3'
            },
            {
              name: 'costo_peajes',
              label: 'Costo peajes',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: '0.01',
              colClass: 'col-md-3'
            },
            {
              name: 'viaticos',
              label: 'Viáticos',
              type: 'number',
              min: 0,
              step: '0.01',
              colClass: 'col-md-3'
            },
            { name: 'cobrado', label: 'Cobrado', type: 'checkbox', defaultValue: false, colClass: 'col-md-3' },
            { name: 'fecha_cobro', label: 'Fecha cobro', type: 'date', colClass: 'col-md-3' },
            {
              name: 'estado',
              label: 'Estado',
              type: 'select',
              required: true,
              defaultValue: 'programado',
              colClass: 'col-md-4',
              options: [
                { label: 'Programado', value: 'programado' },
                { label: 'En curso', value: 'en_curso' },
                { label: 'Completado', value: 'completado' },
                { label: 'Cancelado', value: 'cancelado' }
              ]
            },
            { name: 'observaciones', label: 'Observaciones', type: 'textarea', rows: 2, colClass: 'col-md-8' }
          ]
        }
      },
      {
        path: 'proveedores',
        loadComponent: loadCrudPage,
        data: {
          title: 'Proveedores',
          description: 'Proveedores terceros usados para viajes intermediados.',
          endpoint: '/proveedores',
          displayField: 'nombre',
          duplicateEnabled: true,
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'Propietario', path: 'propietario.nombre', superAdminOnly: true },
            { label: 'RUC/Cédula', path: 'ruc_cedula' },
            { label: 'Teléfono', path: 'telefono' },
            { label: 'Correo', path: 'email' },
            { label: 'Utilidad %', path: 'porcentaje_utilidad' },
            { label: 'Observación', path: 'observacion' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'ruc_cedula', label: 'Cédula/RUC', type: 'text', required: true, colClass: 'col-md-3' },
            { name: 'telefono', label: 'Teléfono', type: 'text', colClass: 'col-md-3' },
            { name: 'email', label: 'Correo', type: 'email', colClass: 'col-md-6' },
            {
              name: 'porcentaje_utilidad',
              label: 'Utilidad %',
              type: 'number',
              defaultValue: 0,
              min: 0,
              max: 100,
              step: '0.01',
              colClass: 'col-md-3'
            },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            { name: 'observacion', label: 'Observación', type: 'textarea', rows: 2, colClass: 'col-12' }
          ]
        }
      },
      {
        path: 'proveedores/transporte',
        loadComponent: loadProveedorTransportePage
      },
      {
        path: 'proveedores/resumen',
        loadComponent: loadProveedorResumenPage
      },
      {
        path: 'tipos-mantenimiento',
        loadComponent: loadCrudPage,
        data: {
          title: 'Tipos de mantenimiento',
          description: 'Tipos de mantenimiento y periodicidad por kilometraje o días.',
          endpoint: '/tipos-mantenimiento',
          displayField: 'nombre',
          readonlyGlobalRows: true,
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'Propietario', path: 'propietario.nombre', superAdminOnly: true },
            { label: 'Periódico', path: 'es_periodico', type: 'boolean' },
            { label: 'Intervalo km', path: 'intervalo_km' },
            { label: 'Intervalo días', path: 'intervalo_dias' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'es_periodico', label: 'Periódico', type: 'checkbox', defaultValue: false, colClass: 'col-md-3' },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            { name: 'intervalo_km', label: 'Intervalo km', type: 'number', min: 1, step: 1, colClass: 'col-md-3' },
            { name: 'intervalo_dias', label: 'Intervalo días', type: 'number', min: 1, step: 1, colClass: 'col-md-3' },
            {
              name: 'global',
              label: 'Registro global',
              type: 'checkbox',
              defaultValue: false,
              createOnly: true,
              superAdminOnly: true,
              colClass: 'col-md-3'
            },
            { name: 'descripcion', label: 'Descripción', type: 'textarea', rows: 2, colClass: 'col-12' }
          ]
        }
      },
      {
        path: 'mantenimientos',
        loadComponent: loadMantenimientosPage,
        data: {
          title: 'Mantenimientos',
          description: 'Historial de mantenimientos, costos y repuestos.',
          endpoint: '/mantenimientos',
          columns: [
            { label: 'Fecha', path: 'fecha_mantenimiento', type: 'date' },
            { label: 'Vehículo', path: 'vehiculo.placa' },
            { label: 'Tipo', path: 'tipo_mantenimiento.nombre' },
            { label: 'Descripción', path: 'descripcion' },
            { label: 'Costo total', path: 'costo_total', type: 'money' },
            { label: 'Próx. km', path: 'proximo_mantenimiento_km' },
            { label: 'Estado', path: 'estado', type: 'badge' }
          ]
        }
      },
      {
        path: 'rutas',
        loadComponent: loadRutasPage,
        data: {
          title: 'Destinos',
          description: 'Origen, destino y distancia de los destinos.',
          endpoint: '/rutas',
          displayField: 'destino',
          columns: [
            { label: 'Origen', path: 'origen' },
            { label: 'Destino', path: 'destino' },
            { label: 'Distancia km', path: 'distancia_km' },
            { label: 'Duración', path: 'duracion_estimada_horas', type: 'hoursTime' },
            { label: 'Activa', path: 'activa', type: 'boolean' }
          ],
          fields: [
            { name: 'origen', label: 'Origen', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'destino', label: 'Destino', type: 'text', required: true, colClass: 'col-md-6' },
            {
              name: 'distancia_km',
              label: 'Distancia km',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: '0.01',
              colClass: 'col-md-4'
            },
            {
              name: 'duracion_estimada_horas',
              label: 'Duración estimada',
              type: 'time',
              parseAs: 'hoursTime',
              colClass: 'col-md-4'
            },
            { name: 'activa', label: 'Activa', type: 'checkbox', defaultValue: true, colClass: 'col-md-2' },
            { name: 'global', label: 'Registro global', type: 'checkbox', defaultValue: false, colClass: 'col-md-2' }
          ]
        }
      },
      {
        path: 'tipos-carga',
        loadComponent: loadCrudPage,
        data: {
          title: 'Tipos de carga',
          description: 'Tipos de carga globales y propios para tarifas de ruta.',
          endpoint: '/tipos-carga',
          displayField: 'nombre',
          readonlyGlobalRows: true,
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'Origen', path: 'origen', type: 'badge' },
            { label: 'Propietario', path: 'propietario_nombre', superAdminOnly: true },
            { label: 'Descripción', path: 'descripcion' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            {
              name: 'global',
              label: 'Registro global',
              type: 'checkbox',
              defaultValue: false,
              createOnly: true,
              superAdminOnly: true,
              colClass: 'col-md-3'
            },
            { name: 'descripcion', label: 'Descripción', type: 'textarea', rows: 2, colClass: 'col-12' }
          ]
        }
      },
      {
        path: 'peajes',
        loadComponent: loadPeajesPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'Peajes',
          description: 'Peajes globales y propios disponibles para rutas.',
          endpoint: '/peajes',
          displayField: 'nombre',
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'Ubicación', path: 'ubicacion' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'ubicacion', label: 'Ubicación', type: 'text', colClass: 'col-md-6' },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            { name: 'global', label: 'Registro global', type: 'checkbox', defaultValue: false, colClass: 'col-md-3' }
          ]
        }
      },
      {
        path: 'rutas-peajes',
        loadComponent: loadCrudPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'Rutas peajes',
          description: 'Relación entre rutas y peajes por orden y sentido.',
          endpoint: '/rutas-peajes',
          displayField: 'peaje.nombre',
          columns: [
            { label: 'Origen', path: 'ruta.origen' },
            { label: 'Destino', path: 'ruta.destino' },
            { label: 'Peaje', path: 'peaje.nombre' },
            { label: 'Orden', path: 'orden' },
            { label: 'Sentido', path: 'sentido', type: 'badge' }
          ],
          fields: [
            {
              name: 'ruta_id',
              label: 'Ruta',
              type: 'select',
              required: true,
              colClass: 'col-md-6',
              catalog: {
                endpoint: '/rutas',
                valuePath: 'id',
                labelPath: 'destino',
                labelPaths: ['origen', 'destino'],
                params: { activa: true }
              }
            },
            {
              name: 'peaje_id',
              label: 'Peaje',
              type: 'select',
              required: true,
              colClass: 'col-md-6',
              catalog: {
                endpoint: '/peajes',
                valuePath: 'id',
                labelPath: 'nombre',
                params: { activo: true }
              }
            },
            { name: 'orden', label: 'Orden', type: 'number', min: 1, step: 1, colClass: 'col-md-3' },
            {
              name: 'sentido',
              label: 'Sentido',
              type: 'select',
              required: true,
              defaultValue: 'ambos',
              colClass: 'col-md-3',
              options: [
                { label: 'Ida', value: 'ida' },
                { label: 'Retorno', value: 'retorno' },
                { label: 'Ambos', value: 'ambos' }
              ]
            },
            { name: 'global', label: 'Registro global', type: 'checkbox', defaultValue: false, colClass: 'col-md-3' }
          ]
        }
      },
      {
        path: 'tarifas-ruta',
        loadComponent: loadCrudPage,
        data: {
          title: 'Precios',
          description: 'Precios por ruta, tipo de carga, capacidad y vigencia.',
          endpoint: '/tarifas-ruta',
          displayField: 'ruta.destino',
          duplicateEnabled: true,
          columns: [
            { label: 'Origen', path: 'ruta.origen' },
            { label: 'Destino', path: 'ruta.destino' },
            { label: 'Propietario', path: 'propietario.nombre', superAdminOnly: true },
            { label: 'Tipo de carga', path: 'tipo_carga.nombre' },
            { label: 'Capacidad', path: 'capacidad' },
            { label: 'Toneladas', path: 'toneladas' },
            { label: 'Precio', path: 'precio', type: 'money' },
            { label: 'Desde', path: 'vigente_desde', type: 'date' },
            { label: 'Activa', path: 'activa', type: 'boolean' }
          ],
          fields: [
            {
              name: 'ruta_id',
              label: 'Ruta',
              type: 'select',
              required: true,
              colClass: 'col-md-6',
              catalog: {
                endpoint: '/rutas',
                valuePath: 'id',
                labelPath: 'destino',
                labelPaths: ['origen', 'destino'],
                params: { activa: true, solo_propios: true }
              }
            },
            {
              name: 'tipo_carga_id',
              label: 'Tipo de carga',
              type: 'select',
              required: true,
              colClass: 'col-md-6',
              catalog: {
                endpoint: '/tipos-carga',
                valuePath: 'id',
                labelPath: 'nombre',
                params: { activo: true, solo_propios: true }
              }
            },
            { name: 'capacidad', label: 'Capacidad cartones', type: 'text', colClass: 'col-md-3' },
            { name: 'toneladas', label: 'Toneladas', type: 'number', min: 0, step: '0.01', colClass: 'col-md-3' },
            { name: 'precio', label: 'Precio', type: 'number', required: true, min: 0, step: '0.01', colClass: 'col-md-3' },
            { name: 'activa', label: 'Activa', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            {
              name: 'vigente_desde',
              label: 'Vigente desde',
              type: 'date',
              defaultValue: todayInputDate,
              colClass: 'col-md-6'
            },
            {
              name: 'vigente_hasta',
              label: 'Vigente hasta',
              type: 'date',
              defaultValue: () => yearsFromTodayInputDate(3),
              colClass: 'col-md-6'
            }
          ]
        }
      },
      { path: 'cierre-semanal', loadComponent: loadWeeklyClosurePage },
      { path: 'reportes', loadComponent: loadReportsPage },
      { path: 'utilidad', loadComponent: loadUtilityReportPage },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },
  { path: '', pathMatch: 'full', redirectTo: 'app/dashboard' },
  { path: '**', redirectTo: 'app/dashboard' }
];

