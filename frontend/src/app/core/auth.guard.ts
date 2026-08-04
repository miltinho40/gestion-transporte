import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn | CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const targetUrl = state?.url ?? '';
  if (auth.requiresPasswordChange() && !targetUrl.startsWith('/app/cambiar-clave')) {
    return router.createUrlTree(['/app/cambiar-clave'], {
      queryParams: {
        obligatorio: '1'
      }
    });
  }

  return true;
};
