<?php

namespace App\Enums;

enum Role: string
{
    case EnFila = 'en_fila';
    case Jugador = 'jugador';
    case DungeonMaster = 'dungeon_master';

    public function label(): string
    {
        return match ($this) {
            self::EnFila => 'En Fila',
            self::Jugador => 'Jugador',
            self::DungeonMaster => 'Dungeon Master',
        };
    }

    /** Roles que un admin puede asignar al aceptar/editar un usuario. */
    public static function assignable(): array
    {
        return array_map(fn (self $r) => $r->value, self::cases());
    }
}
