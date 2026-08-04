import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const authenticatedRequest = req.clone({
    withCredentials: true,
    ...(token
      ? {
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        }
      : {})
  });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const isAuthEndpoint = /\/auth\/(login|refresh|logout)$/.test(req.url);
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        isAuthEndpoint
      ) {
        return throwError(() => error);
      }

      return auth.refreshSession().pipe(
        switchMap(() => {
          const refreshedToken = auth.token();
          if (!refreshedToken) return throwError(() => error);
          return next(
            req.clone({
              withCredentials: true,
              setHeaders: {
                Authorization: `Bearer ${refreshedToken}`
              }
            })
          );
        }),
        catchError((refreshError) => {
          auth.clearSession();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
