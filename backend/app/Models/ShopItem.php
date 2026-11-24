<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ShopItem extends Model
{
    protected $fillable = [
        'merchant_id',
        'name',
        'description',
        'price_gp',
        'image_path',
        'inspect_pose',
    ];

    protected $attributes = [
        'inspect_pose' => 'explaining',
    ];

    protected $hidden = ['image_path'];

    protected $appends = ['image_url'];

    protected static function booted(): void
    {
        static::deleted(fn (ShopItem $item) => $item->deleteImageFile());
    }

    protected function casts(): array
    {
        return [
            'price_gp' => 'integer',
            'sold_at' => 'datetime',
        ];
    }

    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn () => $this->image_path
            ? Storage::disk('public')->url($this->image_path)
            : null);
    }

    public function deleteImageFile(): void
    {
        if ($this->image_path) {
            Storage::disk('public')->delete($this->image_path);
        }
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }
}
