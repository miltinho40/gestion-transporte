import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.usuario()?.es_super_admin || auth.contexto()?.rol === 'admin') {
    return true;
  }

  return router.createUrlTree(['/app/dashboard']);
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.usuario()?.es_super_admin) {
    return true;
  }

  return router.createUrlTree(['/app/dashboard']);
};
