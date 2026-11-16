<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->is_superadmin) {
            return response()->json(['message' => 'Solo el superadmin puede hacer esto.'], 403);
        }
        return $next($request);
    }
}
