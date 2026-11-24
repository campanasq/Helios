<?php

use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\MissionController;
use App\Http\Controllers\Api\ShopController;
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
        Route::post('/characters/{character}/kill', [CharacterController::class, 'kill']);
        Route::post('/characters/{character}/avatar', [CharacterController::class, 'uploadAvatar']);
        Route::delete('/characters/{character}/avatar', [CharacterController::class, 'deleteAvatar']);
        Route::post('/characters/{character}/images', [CharacterController::class, 'uploadImage']);
        Route::patch('/characters/{character}/images/{image}', [CharacterController::class, 'updateImage']);
        Route::delete('/characters/{character}/images/{image}', [CharacterController::class, 'deleteImage']);
        Route::post('/characters/{character}/wallet/convert', [CharacterController::class, 'convertWallet']);
        Route::get('/gallery', [CharacterController::class, 'gallery']);
        Route::get('/missions', [MissionController::class, 'index']);
        Route::get('/missions/{mission}', [MissionController::class, 'show']);
        Route::get('/shop', [ShopController::class, 'index']);
        Route::post('/shop/items/{item}/buy', [ShopController::class, 'buy']);
    });

    // Solo Dungeon Master
    Route::middleware('role:dungeon_master')->group(function () {
        Route::get('/all-characters', [CharacterController::class, 'all']);
        Route::post('/characters/{character}/wallet/adjust', [CharacterController::class, 'adjustWallet']);
        Route::post('/missions', [MissionController::class, 'store']);
        Route::put('/missions/{mission}', [MissionController::class, 'update']);
        Route::delete('/missions/{mission}', [MissionController::class, 'destroy']);

        // Gestión de Tienda y Mercaderes ambulantes
        Route::get('/shop/merchants', [ShopController::class, 'merchants']);
        Route::post('/shop/merchants', [ShopController::class, 'storeMerchant']);
        Route::put('/shop/merchants/{merchant}', [ShopController::class, 'updateMerchant']);
        Route::delete('/shop/merchants/{merchant}', [ShopController::class, 'destroyMerchant']);
        Route::post('/shop/merchants/{merchant}/activate', [ShopController::class, 'activateMerchant']);
        Route::post('/shop/merchants/{merchant}/poses/{pose}', [ShopController::class, 'uploadPose']);
        Route::delete('/shop/merchants/{merchant}/poses/{pose}', [ShopController::class, 'deletePose']);
        Route::post('/shop/merchants/{merchant}/items', [ShopController::class, 'storeItem']);
        Route::post('/shop/items/{item}', [ShopController::class, 'updateItem']);
        Route::put('/shop/items/{item}', [ShopController::class, 'updateItem']);
        Route::delete('/shop/items/{item}', [ShopController::class, 'destroyItem']);
        Route::get('/shop/purchases', [ShopController::class, 'purchases']);
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
