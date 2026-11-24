<?php

namespace App\Models;

use App\Support\CharacterSheet;
use App\Support\GalleryVisibility;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Character extends Model
{
    protected $fillable = [
        'name', 'race', 'class', 'level', 'alignment', 'background',
        'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
        'hit_points', 'armor_class', 'backstory', 'sheet', 'gallery_visibility',
    ];

    protected $attributes = [
        'is_dead' => false,
        'is_npc' => false,
    ];

    protected $hidden = ['avatar_path'];

    protected $appends = ['avatar_url'];

    protected static function booted(): void
    {
        // Al borrar el personaje, borra también su avatar y sus imágenes adicionales del disco
        static::deleting(function (Character $c) {
            $c->images()->get()->each->deleteFile();
        });
        static::deleted(fn (Character $c) => $c->deleteAvatarFile());
    }

    protected function casts(): array
    {
        return [
            'level' => 'integer',
            'strength' => 'integer',
            'dexterity' => 'integer',
            'constitution' => 'integer',
            'intelligence' => 'integer',
            'wisdom' => 'integer',
            'charisma' => 'integer',
            'hit_points' => 'integer',
            'armor_class' => 'integer',
            'is_dead' => 'boolean',
            'died_at' => 'datetime',
            'is_npc' => 'boolean',
        ];
    }

    /** La hoja siempre sale completa (con defaults), aunque sea un personaje antiguo. */
    protected function sheet(): Attribute
    {
        return Attribute::make(
            get: fn (?string $v) => CharacterSheet::normalize($v ? json_decode($v, true) : []),
            set: fn (?array $v) => json_encode(CharacterSheet::normalize($v)),
        );
    }

    /** Preferencias de visibilidad en la Galería de personajes (siempre normalizadas). */
    protected function galleryVisibility(): Attribute
    {
        return Attribute::make(
            get: fn (?string $v, array $attrs) => GalleryVisibility::normalize(
                $v ? json_decode($v, true) : null,
                (bool) ($attrs['is_npc'] ?? false),
            ),
            set: fn (?array $v, array $attrs) => json_encode(GalleryVisibility::normalize(
                $v,
                (bool) ($attrs['is_npc'] ?? false),
            )),
        );
    }

    protected function avatarUrl(): Attribute
    {
        return Attribute::get(fn () => $this->avatar_path
            ? Storage::disk('public')->url($this->avatar_path)
            : null);
    }

    public function deleteAvatarFile(): void
    {
        if ($this->avatar_path) {
            Storage::disk('public')->delete($this->avatar_path);
        }
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(CharacterImage::class)->orderBy('sort_order')->orderBy('id');
    }
}
