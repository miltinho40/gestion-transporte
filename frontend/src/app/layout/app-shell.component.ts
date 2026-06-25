import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideBell,
  LucideChevronDown,
  LucideClipboardList,
  LucideFileSpreadsheet,
  LucideHandshake,
  LucideKeyRound,
  LucideLogOut,
  LucideMap,
  LucideRoute,
  LucideShieldCheck,
  LucideTruck,
  LucideUsers,
  LucideWrench
} from '@lucide/angular';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideBell,
    LucideChevronDown,
    LucideClipboardList,
    LucideFileSpreadsheet,
    LucideHandshake,
    LucideKeyRound,
    LucideLogOut,
    LucideMap,
    LucideRoute,
    LucideShieldCheck,
    LucideTruck,
    LucideUsers,
    LucideWrench
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly isSuperAdmin = computed(() => this.auth.isSuperAdmin());
  readonly isAdmin = computed(
    () => this.auth.usuario()?.es_super_admin || this.auth.contexto()?.rol === 'admin'
  );
  readonly isPropietario = computed(() => this.auth.hasOwnFleet());
  readonly isIntermediario = computed(() => this.auth.isIntermediary());
  readonly showTransporte = computed(
    () =>
      this.canOwnFleet('viajes') ||
      this.canOwnFleet('cierre_semanal') ||
      this.canOwnFleet('utilidad') ||
      this.canOwnFleet('vehiculos') ||
      this.canOwnFleet('conductores') ||
      this.hasPermission('rutas') ||
      this.hasPermission('tarifas_ruta') ||
      this.hasPermission('tipos_carga')
  );
  readonly showProveedores = computed(
    () =>
      this.canIntermediario('proveedores') ||
      this.canIntermediario('proveedor_viajes') ||
      this.canIntermediario('proveedor_resumen')
  );
  readonly showMantenimiento = computed(
    () => this.canOwnFleet('tipos_mantenimiento') || this.canOwnFleet('mantenimientos')
  );
  readonly showConfiguraciones = computed(
    () => this.isAdmin() && this.canOwnFleet('configuraciones')
  );
  readonly expandedSections = signal<Record<string, boolean>>({
    peajes: true,
    transporte: true,
    proveedores: true,
    mantenimiento: true,
    administrador: true,
    reportes: true
  });

  isSectionOpen(section: string) {
    return this.expandedSections()[section] ?? true;
  }

  toggleSection(section: string) {
    this.expandedSections.update((current) => ({
      ...current,
      [section]: !(current[section] ?? true)
    }));
  }

  hasPermission(permission: string) {
    return this.auth.hasMenuPermission(permission);
  }

  canOwnFleet(permission: string) {
    return this.isPropietario() && this.hasPermission(permission);
  }

  canIntermediario(permission: string) {
    return this.isIntermediario() && this.hasPermission(permission);
  }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
