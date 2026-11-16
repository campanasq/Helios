<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Mission extends Model
{
    public const DIFFICULTIES = ['facil', 'media', 'dificil', 'mortal'];
    public const STATUSES = ['abierta', 'en_curso', 'completada'];

    protected $fillable = [
        'title', 'description', 'difficulty', 'status', 'min_level', 'reward',
    ];

    protected function casts(): array
    {
        return ['min_level' => 'integer'];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
