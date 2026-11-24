<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class CharacterImage extends Model
{
    protected $fillable = [
        'path',
        'caption',
        'show_in_gallery',
        'sort_order',
    ];

    protected $attributes = [
        'show_in_gallery' => true,
        'sort_order' => 0,
    ];

    protected $hidden = ['path'];

    protected $appends = ['url'];

    protected static function booted(): void
    {
        static::deleted(fn (CharacterImage $img) => $img->deleteFile());
    }

    protected function casts(): array
    {
        return [
            'show_in_gallery' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected function url(): Attribute
    {
        return Attribute::get(fn () => Storage::disk('public')->url($this->path));
    }

    public function deleteFile(): void
    {
        if ($this->path) {
            Storage::disk('public')->delete($this->path);
        }
    }

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }
}
