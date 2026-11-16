<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    protected $fillable = [
        'name', 'race', 'class', 'level', 'alignment', 'background',
        'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
        'hit_points', 'armor_class', 'backstory',
    ];

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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
