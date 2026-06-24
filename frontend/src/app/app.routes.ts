import { Routes } from '@angular/router';
import { superAdminGuard } from './core/admin.guard';
import { authGuard } from './core/auth.guard';
import { AppShellComponent } from './layout/app-shell.component';
import { MobileShellComponent } from './layout/mobile-shell.component';

const loadAcceptInvitationPage = () =>
  import('./pages/accept-invitation/accept-invitation-page.component').then(
    (m) => m.AcceptInvitationPageComponent
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
const loadReportsPage = () =>
  import('./pages/reports/reports-page.component').then((m) => m.ReportsPageComponent);
const loadRutasPage = () => import('./pages/rutas/rutas-page.component').then((m) => m.RutasPageComponent);
const loadUtilityReportPage = () =>
  import('./pages/utility-report/utility-report-page.component').then(
    (m) => m.UtilityReportPageComponent
  );
const loadViajesPage = () => import('./pages/viajes/viajes-page.component').then((m) => m.ViajesPageComponent);
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
        path: 'viajes',
        loadComponent: () =>
          import('./pages/mobile-viajes/mobile-viajes-page.component').then((m) => m.MobileViajesPageComponent)
      },
      {
        path: 'viajes/nuevo',
        loadComponent: () =>
          import('./pages/mobile-viajes/mobile-viaje-form-page.component').then((m) => m.MobileViajeFormPageComponent)
      },
      {
        path: 'viajes/:id/editar',
        loadComponent: () =>
          import('./pages/mobile-viajes/mobile-viaje-form-page.component').then((m) => m.MobileViajeFormPageComponent)
      },
      {
        path: 'mantenimientos',
        loadComponent: () =>
          import('./pages/mobile-mantenimientos/mobile-mantenimientos-page.component').then(
            (m) => m.MobileMantenimientosPageComponent
          )
      },
      {
        path: 'mantenimientos/nuevo',
        loadComponent: () =>
          import('./pages/mobile-mantenimientos/mobile-mantenimiento-form-page.component').then(
            (m) => m.MobileMantenimientoFormPageComponent
          )
      },
      {
        path: 'mantenimientos/:id/editar',
        loadComponent: () =>
          import('./pages/mobile-mantenimientos/mobile-mantenimiento-form-page.component').then(
            (m) => m.MobileMantenimientoFormPageComponent
          )
      },
      {
        path: 'cierre-semanal',
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
            { label: 'RUC/CÃ©dula', path: 'ruc_cedula' },
            { label: 'Contacto', path: 'contacto_nombre' },
            { label: 'TelÃ©fono', path: 'telefono' },
            { label: 'Email', path: 'email' },
            { label: 'SuscripciÃ³n', path: 'estado_suscripcion', type: 'badge' },
            { label: 'VehÃ­culos', path: 'uso_vehiculos' },
            { label: 'Precio vehÃ­culo', path: 'precio_por_vehiculo', type: 'money' },
            { label: 'Total mensual', path: 'total_mensual_estimado', type: 'money' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'ruc_cedula', label: 'RUC/CÃ©dula', type: 'text', required: true, colClass: 'col-md-3' },
            { name: 'telefono', label: 'TelÃ©fono', type: 'text', colClass: 'col-md-3' },
            { name: 'contacto_nombre', label: 'Contacto', type: 'text', colClass: 'col-md-6' },
            { name: 'email', label: 'Email', type: 'email', colClass: 'col-md-6' },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            {
              name: 'estado_suscripcion',
              label: 'SuscripciÃ³n',
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
              label: 'LÃ­mite vehÃ­culos',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: 1,
              colClass: 'col-md-3'
            },
            {
              name: 'precio_por_vehiculo',
              label: 'Precio por vehÃ­culo',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: '0.01',
              colClass: 'col-md-3'
            },
            {
              name: 'fecha_corte_facturacion',
              label: 'DÃ­a de corte',
              type: 'number',
              defaultValue: 1,
              min: 1,
              max: 31,
              step: 1,
              colClass: 'col-md-3'
            },
            { name: 'direccion', label: 'DirecciÃ³n', type: 'textarea', rows: 2, colClass: 'col-12' },
            {
              name: 'observaciones_facturacion',
              label: 'Observaciones facturacion',
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
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'Email', path: 'email' },
            { label: 'Superadmin', path: 'es_super_admin', type: 'boolean' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'email', label: 'Email', type: 'email', required: true, colClass: 'col-md-6' },
            {
              name: 'password',
              label: 'Clave inicial',
              type: 'text',
              required: true,
              createOnly: true,
              colClass: 'col-md-4'
            },
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
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' }
          ]
        }
      },
      {
        path: 'planes',
        loadComponent: loadCrudPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'Planes y suscripciones',
          description: 'Control de lÃ­mite de vehÃ­culos, precio por vehÃ­culo y estado de cobro.',
          endpoint: '/propietarios',
          displayField: 'nombre',
          createEnabled: false,
          deleteEnabled: false,
          columns: [
            { label: 'Propietario', path: 'nombre' },
            { label: 'SuscripciÃ³n', path: 'estado_suscripcion', type: 'badge' },
            { label: 'VehÃ­culos', path: 'uso_vehiculos' },
            { label: 'Facturables', path: 'vehiculos_facturables' },
            { label: 'Precio vehÃ­culo', path: 'precio_por_vehiculo', type: 'money' },
            { label: 'Total mensual', path: 'total_mensual_estimado', type: 'money' },
            { label: 'DÃ­a corte', path: 'fecha_corte_facturacion' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            {
              name: 'estado_suscripcion',
              label: 'SuscripciÃ³n',
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
              label: 'LÃ­mite vehÃ­culos',
              type: 'number',
              min: 0,
              step: 1,
              colClass: 'col-md-4'
            },
            {
              name: 'precio_por_vehiculo',
              label: 'Precio por vehÃ­culo',
              type: 'number',
              min: 0,
              step: '0.01',
              colClass: 'col-md-4'
            },
            {
              name: 'fecha_corte_facturacion',
              label: 'DÃ­a de corte',
              type: 'number',
              min: 1,
              max: 31,
              step: 1,
              colClass: 'col-md-4'
            },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-4' },
            {
              name: 'observaciones_facturacion',
              label: 'Observaciones facturacion',
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
          title: 'ConfiguraciÃ³n diÃ©sel',
          description: 'Precio global del galÃ³n de diÃ©sel definido solo por el superadmin.',
          endpoint: '/configuraciones/superadmin',
          displayField: 'nombre',
          createEnabled: false,
          deleteEnabled: false,
          columns: [
            { label: 'ConfiguraciÃ³n', path: 'nombre' },
            { label: 'Clave', path: 'clave' },
            { label: 'Valor', path: 'valor' },
            { label: 'DescripciÃ³n', path: 'descripcion' }
          ],
          fields: [
            {
              name: 'valor',
              label: 'Precio galÃ³n diÃ©sel',
              type: 'number',
              required: true,
              min: 0,
              step: '0.01',
              colClass: 'col-md-4'
            },
            {
              name: 'descripcion',
              label: 'DescripciÃ³n',
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
          description: 'ParÃ¡metros propios del propietario para bonos y alertas.',
          endpoint: '/configuraciones',
          displayField: 'nombre',
          createEnabled: false,
          deleteEnabled: false,
          columns: [
            { label: 'ConfiguraciÃ³n', path: 'nombre' },
            { label: 'Clave', path: 'clave' },
            { label: 'Valor', path: 'valor' },
            { label: 'Origen', path: 'origen', type: 'badge' },
            { label: 'DescripciÃ³n', path: 'descripcion' }
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
              label: 'DescripciÃ³n',
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
          description: 'Clientes activos, comisiÃ³n y datos de contacto.',
          endpoint: '/clientes',
          displayField: 'nombre',
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'RUC/CÃ©dula', path: 'ruc_cedula' },
            { label: 'TelÃ©fono', path: 'telefono' },
            { label: 'ComisiÃ³n %', path: 'porcentaje_comision' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'ruc_cedula', label: 'RUC/CÃ©dula', type: 'text', required: true, colClass: 'col-md-3' },
            { name: 'telefono', label: 'TelÃ©fono', type: 'text', colClass: 'col-md-3' },
            { name: 'contacto_nombre', label: 'Contacto', type: 'text', colClass: 'col-md-6' },
            { name: 'email', label: 'Email', type: 'email', colClass: 'col-md-6' },
            {
              name: 'porcentaje_comision',
              label: 'ComisiÃ³n %',
              type: 'number',
              defaultValue: 0,
              min: 0,
              max: 100,
              step: '0.01',
              colClass: 'col-md-3'
            },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            { name: 'direccion', label: 'DirecciÃ³n', type: 'textarea', rows: 2, colClass: 'col-12' }
          ]
        }
      },
      {
        path: 'conductores',
        loadComponent: loadCrudPage,
        data: {
          title: 'Conductores',
          description: 'Conductores, licencias, telÃ©fono obligatorio y sueldo semanal.',
          endpoint: '/conductores',
          displayField: 'nombre',
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'CÃ©dula', path: 'cedula' },
            { label: 'TelÃ©fono', path: 'telefono' },
            { label: 'Sueldo semanal', path: 'sueldo_semanal', type: 'money' },
            { label: 'Caduca licencia', path: 'fecha_caducidad_licencia', type: 'date' },
            { label: 'Estado', path: 'estado', type: 'badge' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'cedula', label: 'CÃ©dula', type: 'text', required: true, colClass: 'col-md-3' },
            { name: 'telefono', label: 'TelÃ©fono', type: 'text', required: true, colClass: 'col-md-3' },
            { name: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date', colClass: 'col-md-4' },
            {
              name: 'numero_licencia',
              label: 'NÃºmero de licencia',
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
          title: 'VehÃ­culos',
          description: 'Flota, capacidad, tonelaje, rendimiento y kilometraje actual.',
          endpoint: '/vehiculos',
          displayField: 'placa',
          columns: [
            { label: 'Placa', path: 'placa' },
            { label: 'Marca', path: 'marca' },
            { label: 'Modelo', path: 'modelo' },
            { label: 'CategorÃ­a de peaje', path: 'categoria_peaje.nombre' },
            { label: 'Capacidad', path: 'capacidad' },
            { label: 'Toneladas', path: 'toneladas' },
            { label: 'Km actual', path: 'kilometraje_actual' },
            { label: 'Estado', path: 'estado', type: 'badge' },
            { label: 'Facturable', path: 'facturable', type: 'boolean' }
          ],
          fields: [
            {
              name: 'categoria_peaje_id',
              label: 'CategorÃ­a de peaje',
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
            { name: 'anio', label: 'AÃ±o', type: 'number', min: 1900, max: 2100, colClass: 'col-md-4' },
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
              label: 'Rendimiento km/galÃ³n',
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
            { name: 'fecha_alta_facturacion', label: 'Alta facturacion', type: 'date', colClass: 'col-md-3' },
            { name: 'fecha_baja_facturacion', label: 'Baja facturacion', type: 'date', colClass: 'col-md-3' }
          ]
        }
      },
      {
        path: 'categorias-peaje',
        loadComponent: loadCrudPage,
        canActivate: [superAdminGuard],
        data: {
          title: 'CategorÃ­as de peaje',
          description: 'CategorÃ­as usadas para clasificar vehÃ­culos y calcular tarifas de peaje.',
          endpoint: '/categorias-peaje',
          displayField: 'nombre',
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'NÃºmero de ejes', path: 'numero_ejes' },
            { label: 'DescripciÃ³n', path: 'descripcion' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            {
              name: 'numero_ejes',
              label: 'NÃºmero de ejes',
              type: 'number',
              min: 0,
              step: 1,
              colClass: 'col-md-3'
            },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            { name: 'global', label: 'Registro global', type: 'checkbox', defaultValue: false, colClass: 'col-md-3' },
            { name: 'descripcion', label: 'DescripciÃ³n', type: 'textarea', rows: 2, colClass: 'col-12' }
          ]
        }
      },
      {
        path: 'viajes',
        loadComponent: loadViajesPage,
        data: {
          title: 'Viajes',
          description: 'Viajes, fletes, gastos y estado de cobro.',
          endpoint: '/viajes',
          displayField: 'descripcion_carga',
          columns: [
            { label: 'Fecha', path: 'fecha_salida', type: 'date' },
            { label: 'Cliente', path: 'cliente.nombre' },
            { label: 'VehÃ­culo', path: 'vehiculo.placa' },
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
              label: 'VehÃ­culo',
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
                params: { activa: true }
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
              label: 'DescripciÃ³n carga',
              type: 'textarea',
              rows: 2,
              colClass: 'col-md-6'
            },
            {
              name: 'numeros_guia_remision',
              label: 'GuÃ­as de remisiÃ³n',
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
              label: 'Galones diÃ©sel',
              type: 'number',
              defaultValue: 0,
              min: 0,
              step: '0.01',
              colClass: 'col-md-3'
            },
            {
              name: 'costo_diesel',
              label: 'Costo diÃ©sel',
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
              label: 'ViÃ¡ticos',
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
        path: 'tipos-mantenimiento',
        loadComponent: loadCrudPage,
        data: {
          title: 'Tipos de mantenimiento',
          description: 'Tipos de mantenimiento y periodicidad por kilometraje o dÃ­as.',
          endpoint: '/tipos-mantenimiento',
          displayField: 'nombre',
          readonlyGlobalRows: true,
          columns: [
            { label: 'Nombre', path: 'nombre' },
            { label: 'PeriÃ³dico', path: 'es_periodico', type: 'boolean' },
            { label: 'Intervalo km', path: 'intervalo_km' },
            { label: 'Intervalo dÃ­as', path: 'intervalo_dias' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'es_periodico', label: 'PeriÃ³dico', type: 'checkbox', defaultValue: false, colClass: 'col-md-3' },
            { name: 'activo', label: 'Activo', type: 'checkbox', defaultValue: true, colClass: 'col-md-3' },
            { name: 'intervalo_km', label: 'Intervalo km', type: 'number', min: 1, step: 1, colClass: 'col-md-3' },
            { name: 'intervalo_dias', label: 'Intervalo dÃ­as', type: 'number', min: 1, step: 1, colClass: 'col-md-3' },
            {
              name: 'global',
              label: 'Registro global',
              type: 'checkbox',
              defaultValue: false,
              createOnly: true,
              superAdminOnly: true,
              colClass: 'col-md-3'
            },
            { name: 'descripcion', label: 'DescripciÃ³n', type: 'textarea', rows: 2, colClass: 'col-12' }
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
            { label: 'VehÃ­culo', path: 'vehiculo.placa' },
            { label: 'Tipo', path: 'tipo_mantenimiento.nombre' },
            { label: 'DescripciÃ³n', path: 'descripcion' },
            { label: 'Costo total', path: 'costo_total', type: 'money' },
            { label: 'PrÃ³x. km', path: 'proximo_mantenimiento_km' },
            { label: 'Estado', path: 'estado', type: 'badge' }
          ]
        }
      },
      {
        path: 'rutas',
        loadComponent: loadRutasPage,
        data: {
          title: 'Rutas',
          description: 'Origen, destino y distancia de rutas.',
          endpoint: '/rutas',
          displayField: 'destino',
          columns: [
            { label: 'Origen', path: 'origen' },
            { label: 'Destino', path: 'destino' },
            { label: 'Distancia km', path: 'distancia_km' },
            { label: 'DuraciÃ³n', path: 'duracion_estimada_horas', type: 'hoursTime' },
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
              label: 'DuraciÃ³n estimada',
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
            { label: 'Propietario', path: 'propietario_nombre' },
            { label: 'DescripciÃ³n', path: 'descripcion' },
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
            { name: 'descripcion', label: 'DescripciÃ³n', type: 'textarea', rows: 2, colClass: 'col-12' }
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
            { label: 'UbicaciÃ³n', path: 'ubicacion' },
            { label: 'Activo', path: 'activo', type: 'boolean' }
          ],
          fields: [
            { name: 'nombre', label: 'Nombre', type: 'text', required: true, colClass: 'col-md-6' },
            { name: 'ubicacion', label: 'UbicaciÃ³n', type: 'text', colClass: 'col-md-6' },
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
          description: 'RelaciÃ³n entre rutas y peajes por orden y sentido.',
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
          title: 'Tarifas Ruta',
          description: 'Precios por ruta, tipo de carga, capacidad y vigencia.',
          endpoint: '/tarifas-ruta',
          displayField: 'ruta.destino',
          duplicateEnabled: true,
          columns: [
            { label: 'Origen', path: 'ruta.origen' },
            { label: 'Destino', path: 'ruta.destino' },
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
                params: { activa: true }
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
                params: { activo: true }
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

