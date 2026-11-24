import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, queueGuard, roleGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login.component').then((m) => m.LoginComponent) },
  { path: 'registro', canActivate: [guestGuard], loadComponent: () => import('./pages/register.component').then((m) => m.RegisterComponent) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'en-espera', canActivate: [queueGuard], loadComponent: () => import('./pages/waiting.component').then((m) => m.WaitingComponent) },
      {
        path: 'mis-personajes',
        canActivate: [roleGuard('jugador', 'dungeon_master')],
        loadComponent: () => import('./pages/my-characters.component').then((m) => m.MyCharactersComponent),
      },
      {
        path: 'personajes/nuevo',
        canActivate: [roleGuard('jugador', 'dungeon_master')],
        loadComponent: () => import('./pages/character-sheet.component').then((m) => m.CharacterSheetComponent),
      },
      {
        // El backend solo deja ver la hoja al dueño o a un DM
        path: 'personajes/:id',
        canActivate: [roleGuard('jugador', 'dungeon_master')],
        loadComponent: () => import('./pages/character-sheet.component').then((m) => m.CharacterSheetComponent),
      },
      {
        path: 'personajes-usuarios',
        canActivate: [roleGuard('dungeon_master')],
        loadComponent: () => import('./pages/all-characters.component').then((m) => m.AllCharactersComponent),
      },
      {
        path: 'galeria',
        canActivate: [roleGuard('jugador', 'dungeon_master')],
        loadComponent: () => import('./pages/gallery.component').then((m) => m.GalleryComponent),
      },
      {
        path: 'misiones',
        canActivate: [roleGuard('jugador', 'dungeon_master')],
        loadComponent: () => import('./pages/missions.component').then((m) => m.MissionsComponent),
      },
      {
        path: 'tienda',
        canActivate: [roleGuard('jugador', 'dungeon_master')],
        loadComponent: () => import('./pages/shop.component').then((m) => m.ShopComponent),
      },
      { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-users.component').then((m) => m.AdminUsersComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'mis-personajes' },
    ],
  },
  { path: '**', redirectTo: '' },
];
