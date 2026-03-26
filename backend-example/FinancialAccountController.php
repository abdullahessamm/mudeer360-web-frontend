<?php

/**
 * انسخ هذا الملف إلى مشروع Laravel:
 *   app/Http/Controllers/Api/FinancialAccountController.php
 *
 * ثم أضف المسارات من routes-financial-accounts.php إلى routes/api.php
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinancialAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinancialAccountController extends Controller
{
    public function index(): JsonResponse
    {
        $accounts = FinancialAccount::query()->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'payload' => ['data' => $accounts],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'nullable|string|max:100',
        ]);

        $account = FinancialAccount::query()->create($data);

        return response()->json([
            'success' => true,
            'payload' => $account,
        ], 201);
    }

    public function update(Request $request, FinancialAccount $financialAccount): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'nullable|string|max:100',
        ]);

        $financialAccount->update($data);

        return response()->json([
            'success' => true,
            'payload' => $financialAccount->fresh(),
        ]);
    }

    public function destroy(FinancialAccount $financialAccount): JsonResponse
    {
        $balance = (float) ($financialAccount->computed_balance ?? 0);
        if (abs($balance) > 0.00001) {
            return response()->json([
                'message' => 'لا يمكن حذف الحساب ما دام رصيده لا يساوي صفراً.',
            ], 422);
        }

        $financialAccount->delete();

        return response()->json(['success' => true]);
    }
}
