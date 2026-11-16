<?php

namespace App\Support;

/**
 * Normaliza la hoja de personaje (columna JSON "sheet").
 * Descarta claves desconocidas, rellena valores por defecto y acota tipos/longitudes,
 * así el JSON guardado siempre tiene la misma forma.
 */
class CharacterSheet
{
    public const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

    public const SKILLS = [
        'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history',
        'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
        'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival',
    ];

    /** Campos de texto libre => longitud máxima */
    private const TEXT = [
        'player_name' => 100, 'hit_dice' => 50, 'proficiencies_languages' => 3000, 'equipment' => 5000,
        'personality_traits' => 2000, 'ideals' => 1000, 'bonds' => 1000, 'flaws' => 1000,
        'features_traits' => 8000, 'age' => 30, 'height' => 30, 'weight' => 30, 'eyes' => 30,
        'skin' => 30, 'hair' => 30, 'appearance' => 3000, 'allies' => 5000,
        'additional_features' => 8000, 'treasure' => 3000,
    ];

    public static function normalize(?array $in): array
    {
        $in ??= [];
        $out = [];

        foreach (self::TEXT as $key => $max) {
            $out[$key] = self::str($in[$key] ?? '', $max);
        }

        $out['experience'] = self::int($in['experience'] ?? 0, 0, 10_000_000);
        $out['inspiration'] = (bool) ($in['inspiration'] ?? false);
        $out['speed'] = self::int($in['speed'] ?? 30, 0, 999);
        $out['initiative_bonus'] = self::int($in['initiative_bonus'] ?? 0, -20, 20);
        $out['hp_current'] = self::int($in['hp_current'] ?? 0, -999, 9999);
        $out['hp_temp'] = self::int($in['hp_temp'] ?? 0, 0, 9999);

        $out['saving_throws'] = [];
        foreach (self::ABILITIES as $a) {
            $out['saving_throws'][$a] = (bool) ($in['saving_throws'][$a] ?? false);
        }

        // 0 = sin competencia, 1 = competente, 2 = pericia
        $out['skills'] = [];
        foreach (self::SKILLS as $s) {
            $out['skills'][$s] = self::int($in['skills'][$s] ?? 0, 0, 2);
        }

        $out['death_saves'] = [
            'successes' => self::int($in['death_saves']['successes'] ?? 0, 0, 3),
            'failures' => self::int($in['death_saves']['failures'] ?? 0, 0, 3),
        ];

        $out['money'] = [];
        foreach (['cp', 'sp', 'ep', 'gp', 'pp'] as $coin) {
            $out['money'][$coin] = self::int($in['money'][$coin] ?? 0, 0, 100_000_000);
        }

        $out['attacks'] = self::list($in['attacks'] ?? [], 30, fn ($a) => [
            'name' => self::str($a['name'] ?? '', 100),
            'bonus' => self::str($a['bonus'] ?? '', 20),
            'damage' => self::str($a['damage'] ?? '', 100),
        ]);

        $sc = $in['spellcasting'] ?? [];
        $ability = $sc['ability'] ?? '';
        $slots = [];
        for ($lvl = 0; $lvl < 9; $lvl++) {
            $slot = $sc['slots'][$lvl] ?? [];
            $total = self::int($slot['total'] ?? 0, 0, 20);
            $slots[] = ['total' => $total, 'used' => self::int($slot['used'] ?? 0, 0, $total)];
        }
        $out['spellcasting'] = [
            'class' => self::str($sc['class'] ?? '', 50),
            'ability' => in_array($ability, self::ABILITIES, true) ? $ability : '',
            'slots' => $slots,
            'spells' => self::list($sc['spells'] ?? [], 200, fn ($s) => [
                'level' => self::int($s['level'] ?? 0, 0, 9),
                'name' => self::str($s['name'] ?? '', 100),
                'prepared' => (bool) ($s['prepared'] ?? false),
            ]),
        ];

        return $out;
    }

    private static function str(mixed $v, int $max): string
    {
        return is_scalar($v) ? mb_substr(trim((string) $v), 0, $max) : '';
    }

    private static function int(mixed $v, int $min, int $max): int
    {
        return is_numeric($v) ? max($min, min($max, (int) $v)) : max($min, min($max, 0));
    }

    private static function list(mixed $items, int $max, callable $map): array
    {
        if (! is_array($items)) {
            return [];
        }
        $items = array_filter(array_values($items), 'is_array');
        $mapped = array_map($map, array_slice($items, 0, $max));
        // descarta filas totalmente vacías
        return array_values(array_filter($mapped, fn ($row) => ($row['name'] ?? '') !== ''));
    }
}
