<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Uso en rutas: ->middleware('role:jugador,dungeon_master') */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $allowed = array_map(fn ($r) => Role::from($r), $roles);
        if (! $request->user()?->hasRole(...$allowed)) {
            return response()->json(['message' => 'No tienes permiso para acceder a esta sección.'], 403);
        }
        return $next($request);
    }
}
