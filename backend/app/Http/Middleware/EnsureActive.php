<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Bloquea a usuarios dados de baja aunque conserven un token antiguo. */
class EnsureActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && ! $user->is_active) {
            $user->currentAccessToken()?->delete();
            return response()->json(['message' => 'Tu cuenta ha sido dada de baja.'], 403);
        }
        return $next($request);
    }
}
