import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideRefreshCw,
  LucideSave,
  LucideShieldCheck,
  LucideTrash2,
  LucideUserPlus
} from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import {
  MENU_PERMISSIONS,
  MenuPermission,
  groupedMenuPermissions
} from '../../core/menu-permissions';
import { AutoDismissAlertDirective } from '../../shared/auto-dismiss-alert.directive';
import { DialogService } from '../../shared/dialog.service';

interface RolRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  permisos_configurados: boolean;
}

interface RoleForm {
  id: string | null;
  nombre: string;
  descripcion: string;
  permisos: string[];
  permisos_configurados: boolean;
}

const emptyForm = (): RoleForm => ({
  id: null,
  nombre: '',
  descripcion: '',
  permisos: [],
  permisos_configurados: true
});

@Component({
  selector: 'app-roles-permissions-page',
  imports: [
    FormsModule,
    LucideRefreshCw,
    LucideSave,
    LucideShieldCheck,
    LucideTrash2,
    LucideUserPlus,
    AutoDismissAlertDirective
  ],
  templateUrl: './roles-permissions-page.component.html',
  styleUrl: './roles-permissions-page.component.scss'
})
export class RolesPermissionsPageComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(DialogService);

  readonly roles = signal<RolRow[]>([]);
  readonly form = signal<RoleForm>(emptyForm());
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly permissionGroups = Object.entries(groupedMenuPermissions());
  readonly totalPermissions = MENU_PERMISSIONS.length;

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.api.get<RolRow[]>('/roles').subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los roles.');
        this.loading.set(false);
      }
    });
  }

  newRole() {
    this.form.set(emptyForm());
    this.message.set(null);
    this.error.set(null);
  }

  editRole(role: RolRow) {
    this.form.set({
      id: role.id,
      nombre: role.nombre,
      descripcion: role.descripcion ?? '',
      permisos: [...(role.permisos ?? [])],
      permisos_configurados: role.permisos_configurados
    });
    this.message.set(null);
    this.error.set(null);
  }

  updateField<K extends keyof RoleForm>(field: K, value: RoleForm[K]) {
    this.form.update((current) => ({
      ...current,
      [field]: value
    }));
  }

  isSelected(permission: string) {
    return this.form().permisos.includes(permission);
  }

  togglePermission(permission: string, checked: boolean) {
    this.form.update((current) => {
      const permisos = new Set(current.permisos);
      if (checked) {
        permisos.add(permission);
      } else {
        permisos.delete(permission);
      }

      return {
        ...current,
        permisos: [...permisos]
      };
    });
  }

  groupChecked(keys: string[]) {
    return keys.every((key) => this.isSelected(key));
  }

  permissionKeys(permissions: MenuPermission[]) {
    return permissions.map((permission) => permission.key);
  }

  toggleGroup(keys: string[], checked: boolean) {
    this.form.update((current) => {
      const permisos = new Set(current.permisos);
      for (const key of keys) {
        if (checked) {
          permisos.add(key);
        } else {
          permisos.delete(key);
        }
      }

      return {
        ...current,
        permisos: [...permisos]
      };
    });
  }

  save() {
    const current = this.form();
    const nombre = current.nombre.trim().toLowerCase();

    if (!nombre) {
      this.error.set('Ingresa el nombre del rol.');
      return;
    }

    const payload = {
      nombre,
      descripcion: current.descripcion.trim() || null,
      permisos: current.permisos,
      permisos_configurados: current.permisos_configurados
    };
    const request = current.id
      ? this.api.put<RolRow>(`/roles/${current.id}`, payload)
      : this.api.post<RolRow>('/roles', payload);

    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);

    request.subscribe({
      next: (role) => {
        this.saving.set(false);
        this.message.set(current.id ? 'Rol actualizado.' : 'Rol creado.');
        this.editRole(role);
        this.load();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo guardar el rol.');
        this.saving.set(false);
      }
    });
  }

  async deleteCurrent() {
    const current = this.form();
    if (!current.id) return;

    const confirmed = await this.dialog.confirm({
      title: 'Eliminar rol',
      text: `Se eliminará el rol ${current.nombre}. Solo es posible si no está asignado.`,
      confirmText: 'Eliminar'
    });
    if (!confirmed) return;

    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);

    this.api.delete(`/roles/${current.id}`).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Rol eliminado.');
        this.newRole();
        this.load();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo eliminar el rol.');
        this.saving.set(false);
      }
    });
  }
}
