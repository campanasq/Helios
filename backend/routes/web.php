<?php

use Illuminate\Support\Facades\Route;

/**
 * Sirve la SPA de Angular compilada (frontend/dist/frontend/browser) desde el mismo origen
 * que la API cuando se ejecuta Helios en modo unificado / túnel público.
 */
Route::fallback(function () {
    if (request()->is('api/*') || request()->is('storage/*')) {
        abort(404);
    }

    $spa = realpath(base_path('../frontend/dist/frontend/browser'));
    if (! $spa) {
        return view('welcome');
    }

    $reqPath = ltrim(request()->path(), '/');
    if ($reqPath !== '') {
        $candidate = realpath($spa.DIRECTORY_SEPARATOR.$reqPath);
        if ($candidate && str_starts_with($candidate, $spa.DIRECTORY_SEPARATOR) && is_file($candidate)) {
            $mime = match (strtolower(pathinfo($candidate, PATHINFO_EXTENSION))) {
                'js', 'mjs' => 'application/javascript; charset=utf-8',
                'css' => 'text/css; charset=utf-8',
                'webp' => 'image/webp',
                'png' => 'image/png',
                'jpg', 'jpeg' => 'image/jpeg',
                'svg' => 'image/svg+xml',
                'ico' => 'image/x-icon',
                'json' => 'application/json',
                'woff2' => 'font/woff2',
                default => mime_content_type($candidate) ?: 'application/octet-stream',
            };

            return response()->file($candidate, ['Content-Type' => $mime]);
        }
    }

    $index = $spa.DIRECTORY_SEPARATOR.'index.html';

    return is_file($index) ? response()->file($index) : view('welcome');
});
