<?php

use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\MissionController;
use Illuminate\Support\Facades\Route;

// --- Público ---
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

// --- Autenticado (cualquier rol, incluido "en_fila") ---
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Jugador + Dungeon Master
    Route::middleware('role:jugador,dungeon_master')->group(function () {
        Route::apiResource('characters', CharacterController::class);
        Route::get('/missions', [MissionController::class, 'index']);
        Route::get('/missions/{mission}', [MissionController::class, 'show']);
    });

    // Solo Dungeon Master
    Route::middleware('role:dungeon_master')->group(function () {
        Route::get('/all-characters', [CharacterController::class, 'all']);
        Route::post('/missions', [MissionController::class, 'store']);
        Route::put('/missions/{mission}', [MissionController::class, 'update']);
        Route::delete('/missions/{mission}', [MissionController::class, 'destroy']);
    });

    // Admins (y superadmin)
    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::patch('/users/{user}/role', [AdminUserController::class, 'updateRole']);

        // Solo superadmin
        Route::middleware('superadmin')->group(function () {
            Route::patch('/users/{user}/admin', [AdminUserController::class, 'setAdmin']);
            Route::patch('/users/{user}/active', [AdminUserController::class, 'setActive']);
        });
    });
});
