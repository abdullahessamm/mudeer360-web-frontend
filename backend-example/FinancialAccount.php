<?php

/**
 * نموذج Eloquent — انسخ إلى: app/Models/FinancialAccount.php
 * طابق أسماء الأعمدة مع جدولك (مثلاً computed_balance إن وُجد كعمود).
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancialAccount extends Model
{
    protected $fillable = ['name', 'type'];
}
