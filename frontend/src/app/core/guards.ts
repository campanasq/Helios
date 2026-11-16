import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() || inject(Router).parseUrl('/login');
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isLoggedIn() || inject(Router).parseUrl(auth.homeRoute());
};

export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  return auth.hasRole(...roles) || inject(Router).parseUrl(auth.homeRoute());
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() || inject(Router).parseUrl(auth.homeRoute());
};

/** Solo para usuarios en fila (la pantalla de espera). */
export const queueGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.hasRole('en_fila') || inject(Router).parseUrl(auth.homeRoute());
};
