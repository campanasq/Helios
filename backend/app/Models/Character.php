<?php

namespace App\Models;

use App\Support\CharacterSheet;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Character extends Model
{
    protected $fillable = [
        'name', 'race', 'class', 'level', 'alignment', 'background',
        'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
        'hit_points', 'armor_class', 'backstory', 'sheet',
    ];

    protected $hidden = ['avatar_path'];

    protected $appends = ['avatar_url'];

    protected static function booted(): void
    {
        // Al borrar el personaje, borra también su avatar del disco
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
}
