import { HttpInterceptorFn } from '@angular/common/http';

const storageKey = 'gestion_transporte_session';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const raw = localStorage.getItem(storageKey);
  const token = raw ? (JSON.parse(raw) as { token?: string }).token : null;

  if (!token) return next(req);

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
  );
};
