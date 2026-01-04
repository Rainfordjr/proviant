<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ItemController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Categories
    Route::apiResource('categories', CategoryController::class);

    // Items
    Route::get('/items/types', [ItemController::class, 'types']);
    Route::get('/items/units', [ItemController::class, 'units']);
    Route::get('/items/low-stock', [ItemController::class, 'lowStock']);
    Route::get('/items/summary', [ItemController::class, 'summary']);
    Route::post('/items/{item}/adjust-stock', [ItemController::class, 'adjustStock']);
    Route::apiResource('items', ItemController::class);
});