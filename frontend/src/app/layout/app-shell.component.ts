import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideBell,
  LucideChevronDown,
  LucideClipboardList,
  LucideFileSpreadsheet,
  LucideLogOut,
  LucideMap,
  LucideRoute,
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
    LucideLogOut,
    LucideMap,
    LucideRoute,
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
  readonly isSuperAdmin = computed(() => Boolean(this.auth.usuario()?.es_super_admin));
  readonly isAdmin = computed(
    () => this.auth.usuario()?.es_super_admin || this.auth.contexto()?.rol === 'admin'
  );
  readonly expandedSections = signal<Record<string, boolean>>({
    peajes: true,
    transporte: true,
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

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
