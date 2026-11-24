<?php

namespace App\Support;

/**
 * Normaliza qué datos revela un personaje en la Galería de personajes.
 * Descarta claves desconocidas y aplica defaults según sea PJ jugable o NPC.
 */
class GalleryVisibility
{
    public const KEYS = [
        'avatar',
        'name',
        'race',
        'class_level',
        'alignment',
        'background',
        'vitals',
        'stats',
        'owner',
        'backstory',
    ];

    public static function defaults(bool $isNpc = false): array
    {
        if ($isNpc) {
            return [
                'avatar' => true,
                'name' => true,
                'race' => true,
                'class_level' => false,
                'alignment' => false,
                'background' => false,
                'vitals' => false,
                'stats' => false,
                'owner' => false,
                'backstory' => false,
            ];
        }

        return [
            'avatar' => true,
            'name' => true,
            'race' => true,
            'class_level' => true,
            'alignment' => true,
            'background' => true,
            'vitals' => true,
            'stats' => true,
            'owner' => true,
            'backstory' => false,
        ];
    }

    public static function normalize(?array $in, bool $isNpc = false): array
    {
        $defaults = self::defaults($isNpc);
        $in ??= [];
        $out = [];
        foreach (self::KEYS as $key) {
            $out[$key] = array_key_exists($key, $in) ? (bool) $in[$key] : $defaults[$key];
        }
        return $out;
    }
}
