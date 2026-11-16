import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;

  const authReq = req.clone({
    setHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Token inválido o cuenta dada de baja → fuera
      if (err.status === 401 || (err.status === 403 && err.error?.message?.includes('dada de baja'))) {
        auth.clear();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};

/** Extrae un mensaje legible de un error de Laravel. */
export function errorMessage(err: HttpErrorResponse): string {
  const errors = err.error?.errors;
  if (errors) return Object.values(errors).flat().join(' ');
  if (err.status === 0) return 'No se pudo conectar con el servidor.';
  return err.error?.message ?? 'Ha ocurrido un error.';
}
