<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Merchant extends Model
{
    public const POSES = ['idle', 'talking', 'explaining', 'excited', 'angry', 'bored'];
    public const VOICES = ['low', 'medium', 'high', 'mystic'];

    protected $fillable = [
        'name',
        'title',
        'rotation_label',
        'voice_pitch',
        'is_active',
        'greeting',
        'purchase_line',
        'no_gold_line',
        'poses',
        'dialogues',
    ];

    protected $attributes = [
        'voice_pitch' => 'low',
        'is_active' => false,
    ];

    protected $hidden = ['poses'];

    protected $appends = ['pose_urls'];

    protected static function booted(): void
    {
        static::deleting(function (Merchant $m) {
            foreach ($m->poses ?? [] as $path) {
                if ($path) {
                    Storage::disk('public')->delete($path);
                }
            }
            $m->items()->get()->each->deleteImageFile();
        });
    }

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'poses' => 'array',
            'dialogues' => 'array',
        ];
    }

    protected function poseUrls(): Attribute
    {
        return Attribute::get(function (): array {
            $raw = $this->poses ?? [];
            $out = [];
            foreach (self::POSES as $pose) {
                $path = $raw[$pose] ?? null;
                $out[$pose] = $path ? Storage::disk('public')->url($path) : null;
            }
            return $out;
        });
    }

    public function deletePoseFile(string $pose): void
    {
        $poses = $this->poses ?? [];
        if (! empty($poses[$pose])) {
            Storage::disk('public')->delete($poses[$pose]);
            unset($poses[$pose]);
            $this->poses = $poses;
        }
    }

    public function items(): HasMany
    {
        return $this->hasMany(ShopItem::class)->orderBy('id');
    }

    public function availableItems(): HasMany
    {
        return $this->items()->whereNull('sold_at');
    }
}
