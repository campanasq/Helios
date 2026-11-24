<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopPurchase extends Model
{
    protected $fillable = [
        'merchant_id',
        'character_id',
        'user_id',
        'merchant_name',
        'character_name',
        'item_name',
        'item_description',
        'price_gp',
        'purchased_at',
    ];

    protected function casts(): array
    {
        return [
            'price_gp' => 'integer',
            'purchased_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }
}
