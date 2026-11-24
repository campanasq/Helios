<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

/**
 * Gestión exacta del dinero del personaje en D&D 5e (en cobre entero para evitar errores flotantes).
 * 1 Platino (pp) = 10 Oro (gp) = 100 Plata (sp) = 1000 Cobre (cp).
 */
class Wallet
{
    public const COINS = ['cp', 'sp', 'gp', 'pp'];

    public const RATES = [
        'cp' => 1,
        'sp' => 10,
        'gp' => 100,
        'pp' => 1000,
    ];

    public const LABELS = [
        'cp' => 'cobre',
        'sp' => 'plata',
        'gp' => 'oro',
        'pp' => 'platino',
    ];

    private const MAX_COIN = 100_000_000;

    public static function zero(): array
    {
        return ['cp' => 0, 'sp' => 0, 'ep' => 0, 'gp' => 0, 'pp' => 0];
    }

    /** Valor total convertido a piezas de cobre. */
    public static function totalCopper(array $money): int
    {
        return ((int) ($money['pp'] ?? 0)) * 1000
            + ((int) ($money['gp'] ?? 0)) * 100
            + ((int) ($money['sp'] ?? 0)) * 10
            + ((int) ($money['cp'] ?? 0));
    }

    /** Total equivalente en piezas de oro (ej. 162.5). */
    public static function goldTotal(array $money): float
    {
        return round(self::totalCopper($money) / 100, 2);
    }

    /** Aplica deltas positivos o negativos (solo DM). Valida que ninguna moneda quede negativa. */
    public static function adjust(array $money, array $deltas): array
    {
        $out = [
            'cp' => (int) ($money['cp'] ?? 0),
            'sp' => (int) ($money['sp'] ?? 0),
            'ep' => 0,
            'gp' => (int) ($money['gp'] ?? 0),
            'pp' => (int) ($money['pp'] ?? 0),
        ];

        $anyChange = false;
        foreach (self::COINS as $coin) {
            $delta = (int) ($deltas[$coin] ?? 0);
            if ($delta === 0) {
                continue;
            }
            $anyChange = true;
            $next = $out[$coin] + $delta;
            if ($next < 0) {
                throw ValidationException::withMessages([
                    $coin => 'No tiene suficientes monedas de '.self::LABELS[$coin].'.',
                ]);
            }
            if ($next > self::MAX_COIN) {
                throw ValidationException::withMessages([
                    $coin => 'Cantidad máxima superada para '.self::LABELS[$coin].'.',
                ]);
            }
            $out[$coin] = $next;
        }

        if (! $anyChange) {
            throw ValidationException::withMessages([
                'gp' => 'Indicá al menos una cantidad distinta de 0 para ajustar.',
            ]);
        }

        return $out;
    }

    /** Convierte $amount monedas de $from hacia $to conservando exactamente el mismo valor total. */
    public static function convert(array $money, string $from, string $to, int $amount): array
    {
        if (! in_array($from, self::COINS, true) || ! in_array($to, self::COINS, true) || $from === $to) {
            throw ValidationException::withMessages(['from' => 'Seleccioná dos monedas distintas.']);
        }
        if ($amount < 1) {
            throw ValidationException::withMessages(['amount' => 'La cantidad debe ser mayor a 0.']);
        }

        $out = [
            'cp' => (int) ($money['cp'] ?? 0),
            'sp' => (int) ($money['sp'] ?? 0),
            'ep' => 0,
            'gp' => (int) ($money['gp'] ?? 0),
            'pp' => (int) ($money['pp'] ?? 0),
        ];

        if ($out[$from] < $amount) {
            throw ValidationException::withMessages([
                'amount' => 'No tenés suficientes monedas de '.self::LABELS[$from].'.',
            ]);
        }

        $fromRate = self::RATES[$from];
        $toRate = self::RATES[$to];

        if ($fromRate >= $toRate) {
            $gained = $amount * intdiv($fromRate, $toRate);
        } else {
            $ratio = intdiv($toRate, $fromRate);
            if ($amount % $ratio !== 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Para cambiar de '.self::LABELS[$from].' a '.self::LABELS[$to].', ingresá un múltiplo de '.$ratio.'.',
                ]);
            }
            $gained = intdiv($amount, $ratio);
        }

        if ($out[$to] + $gained > self::MAX_COIN) {
            throw ValidationException::withMessages([
                'to' => 'La conversión supera el límite máximo de monedas de '.self::LABELS[$to].'.',
            ]);
        }

        $out[$from] -= $amount;
        $out[$to] += $gained;

        return $out;
    }

    /** Compacta todas las monedas al mínimo número posible (Platino, Oro, Plata y Cobre). */
    public static function compact(array $money): array
    {
        $rem = self::totalCopper($money);
        $pp = intdiv($rem, 1000);
        $rem %= 1000;
        $gp = intdiv($rem, 100);
        $rem %= 100;
        $sp = intdiv($rem, 10);
        $cp = $rem % 10;

        return ['cp' => $cp, 'sp' => $sp, 'ep' => 0, 'gp' => $gp, 'pp' => $pp];
    }
}
