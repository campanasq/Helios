<?php

namespace App\Models;

use App\Enums\Role;
use App\Support\Wallet;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'email_verified_at',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'is_admin' => 'boolean',
            'is_superadmin' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function hasRole(Role ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    /** El superadmin siempre cuenta como admin. */
    public function isAdmin(): bool
    {
        return $this->is_admin || $this->is_superadmin;
    }

    public function characters(): HasMany
    {
        return $this->hasMany(Character::class);
    }

    public function missions(): HasMany
    {
        return $this->hasMany(Mission::class, 'created_by');
    }

    /** Total equivalente en oro del único personaje jugable vivo del usuario (0 si no tiene o murió). */
    protected function goldTotal(): Attribute
    {
        return Attribute::get(function (): float {
            $alive = $this->characters()
                ->where('is_npc', false)
                ->where('is_dead', false)
                ->first();

            return $alive ? Wallet::goldTotal($alive->sheet['money'] ?? []) : 0.0;
        });
    }
}
