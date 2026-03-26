<?php

/**
 * أضف هذا داخل routes/api.php (غالباً داخل مجموعة middleware:sanctum أو auth).
 *
 * مثال:
 *
 * use App\Http\Controllers\Api\FinancialAccountController;
 *
 * Route::middleware(['auth:sanctum'])->group(function () {
 *     Route::apiResource('financial-accounts', FinancialAccountController::class);
 * });
 *
 * Laravel يُسجّل تلقائياً:
 *   GET    /api/financial-accounts       → index
 *   POST   /api/financial-accounts       → store
 *   GET    /api/financial-accounts/{id}  → show (اختياري)
 *   PUT    /api/financial-accounts/{id}  → update
 *   DELETE /api/financial-accounts/{id}  → destroy
 */
