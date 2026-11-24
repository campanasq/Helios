<?php

namespace Database\Seeders;

use App\Models\Merchant;
use Illuminate\Database\Seeder;

class ShopSeeder extends Seeder
{
    public function run(): void
    {
        self::ensureInitialMerchant();
    }

    /** Crea el mercader ambulante inicial con personalidad e ítems de ejemplo si aún no hay ninguno. */
    public static function ensureInitialMerchant(): Merchant
    {
        $existing = Merchant::first();
        if ($existing) {
            if (! Merchant::where('is_active', true)->exists()) {
                $existing->is_active = true;
                $existing->save();
            }
            return $existing;
        }

        $bram = Merchant::create([
            'name' => 'Bram "Colmillo Viejo"',
            'title' => 'Buhonero de la Carreta Vieja',
            'rotation_label' => 'Mercader ambulante · Esta quincena',
            'voice_pitch' => 'low',
            'is_active' => true,
            'greeting' => 'Grrr... ¿Otro aventurero embarrando mi tablón? Mirá tranquilo lo que traigo, pero no toqués sin oro en mano, grrr...',
            'purchase_line' => '¡Grrr-JA! ¡Así me gusta, oro contante y sonante! Cuidalo bien, que me costó media barba conseguirlo.',
            'no_gold_line' => 'Grrr... ¿Y las piezas de ORO? ¡No acepto promesas ni plata suelta sin cambiar! Pasá por tu hoja y convertí monedas a Oro primero, grrr...',
            'dialogues' => [
                [
                    'pose' => 'talking',
                    'text' => 'Grrr... Treinta inviernos arrastrando esta carreta por caminos llenos de barro. Mis rodillas crujen igual que el eje izquierdo.',
                ],
                [
                    'pose' => 'explaining',
                    'text' => 'Antes tenía una fragua en las montañas del norte, ¿sabés? Grrr... Pero cuando un wyvern te derrite el techo, te hacés ambulante o te quedás mirando cenizas.',
                ],
                [
                    'pose' => 'excited',
                    'text' => '¡Grrr-ja! Una vez cambié tres botas gastadas por una lámpara enana que escupía chispas azules. ¡Todavía me río de aquel trato!',
                ],
                [
                    'pose' => 'bored',
                    'text' => 'Grrr... Hay semanas enteras bajo la lluvia en las que no cruzo ni un bandido decente. Al menos mi mula no se pone a regatear...',
                ],
                [
                    'pose' => 'angry',
                    'text' => '¡GRRR! ¡Si seguís tocándome el hombro sin comprar nada, te juro que le subo diez piezas de oro a todo el estante!',
                ],
                [
                    'pose' => 'talking',
                    'text' => 'Grrr... En una semana o dos levanto campamento rumbo al puerto. Lo que veas hoy en mis estantes capaz no vuelve a pasar por acá.',
                ],
            ],
        ]);

        $bram->items()->createMany([
            [
                'name' => 'Frasco de Brasa Eterna',
                'description' => 'Grrr... Frasco de Brasa Eterna. Da luz y calor de antorcha durante horas sin largar humo. Lo saqué de la mochila de un explorador que juró no volver jamás a las cuevas heladas.',
                'price_gp' => 15,
                'inspect_pose' => 'explaining',
            ],
            [
                'name' => 'Daga de Colmillo de Huargo',
                'description' => '¡Grrr-ja, mirá ese filo! Daga de Colmillo de Huargo, liviana y con empuñadura de cuero curado. La talló mi primo antes de perder una partida de dados conmigo.',
                'price_gp' => 25,
                'inspect_pose' => 'excited',
            ],
            [
                'name' => 'Poción de Aliento Firme',
                'description' => 'Poción de Aliento Firme, grrr... Sabe a raíz quemada y menta amarga, pero te corta el temblor y te devuelve el aliento tras un mal golpe. Me la cambió una herborista del pantano.',
                'price_gp' => 10,
                'inspect_pose' => 'talking',
            ],
            [
                'name' => 'Capa Emparchada del Caminante',
                'description' => 'Capa Emparchada del Caminante. Grrr... No va a ganar ningún baile de palacio, pero frena el viento helado y la lluvia mejor que la seda fina. La usé yo dos inviernos enteros.',
                'price_gp' => 18,
                'inspect_pose' => 'bored',
            ],
        ]);

        return $bram;
    }
}
