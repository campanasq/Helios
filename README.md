# Helios — Plataforma D&D

- `backend/` — Laravel 12 + Sanctum (API REST con tokens) + MySQL
- `frontend/` — Angular 20

## Puesta en marcha

### 1. Base de datos (XAMPP)
```bash
sudo /opt/lampp/lampp start
```
Crea la base de datos `helios` (utf8mb4_unicode_ci) en http://localhost/phpmyadmin.
Credenciales en `backend/.env` (por defecto `root` sin contraseña).

### 2. Backend
Crea `backend/.env` (no está en el repo) con al menos:
```env
APP_NAME=Helios
APP_KEY=
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=helios
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

SUPERADMIN_NAME="Super Admin"
SUPERADMIN_EMAIL=tu-email@ejemplo.com
SUPERADMIN_PASSWORD=una-contraseña-segura
```
```bash
cd backend
composer install
php artisan key:generate
php artisan storage:link     # necesario para servir los retratos
php artisan migrate --seed   # crea tablas + usuario superadmin
php artisan serve            # http://localhost:8000
```
El seeder crea el superadmin con los datos `SUPERADMIN_*` del `.env`.

Tests: `php artisan test` (usan SQLite en memoria, no tocan MySQL).

### 3. Frontend
```bash
cd frontend
npm install
npx ng serve                 # http://localhost:4200
```
> Ojo: el comando `ng` del sistema (`/usr/bin/ng`) no es Angular CLI; usa `npx ng`.

La URL de la API se configura en `frontend/src/environments/environment.ts`.

## Roles y permisos

| | En Fila | Jugador | Dungeon Master | Admin | Superadmin |
|---|:-:|:-:|:-:|:-:|:-:|
| Pantalla de espera | ✓ | | | | |
| Mis Personajes (CRUD propio) | | ✓ | ✓ | | |
| Galería de héroes (datos públicos) | | ✓ | ✓ | | |
| Misiones (ver) | | ✓ | ✓ | | |
| Misiones (crear/editar/borrar) | | | ✓ | | |
| Personajes de los usuarios | | | ✓ | | |
| Aceptar usuarios / cambiar rol | | | | ✓ | ✓ |
| Asignar / quitar admins | | | | | ✓ |
| Dar de baja / reactivar usuarios | | | | | ✓ |

- **Rol de juego** (`role`) y **admin** (`is_admin`) son independientes: un admin también tiene rol de juego.
- Todo registro nuevo entra como **En Fila**.
- Nadie puede modificar al superadmin ni a sí mismo; un admin normal no puede modificar a otros admins.
- Dar de baja cierra todas las sesiones del usuario y bloquea su login.

## API

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/register`, `/api/login` | público |
| GET/POST | `/api/me`, `/api/logout` | autenticado |
| CRUD | `/api/characters` | jugador, DM (solo los propios) |
| POST/DELETE | `/api/characters/{id}/avatar` | dueño (PNG, proporción 2:4) |
| GET | `/api/gallery` | jugador, DM |
| GET | `/api/missions` | jugador, DM |
| POST/PUT/DELETE | `/api/missions` | DM |
| GET | `/api/all-characters` | DM |
| GET | `/api/admin/users` | admin |
| PATCH | `/api/admin/users/{id}/role` | admin |
| PATCH | `/api/admin/users/{id}/admin`, `/active` | superadmin |
