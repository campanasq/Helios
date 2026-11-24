<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\Merchant;
use App\Models\ShopItem;
use App\Models\ShopPurchase;
use App\Support\Wallet;
use Database\Seeders\ShopSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ShopController extends Controller
{
    /** Vista pública de la tienda (para jugadores y DMs): mercader activo + ítems disponibles + oro del PJ vivo. */
    public function index(Request $request): JsonResponse
    {
        if (Merchant::count() === 0) {
            ShopSeeder::ensureInitialMerchant();
        }

        $merchant = Merchant::where('is_active', true)
            ->with('availableItems')
            ->first()
            ?? Merchant::with('availableItems')->first();

        $user = $request->user();
        $alive = $user->characters()
            ->where('is_npc', false)
            ->where('is_dead', false)
            ->first();

        $buyer = $alive ? [
            'character_id' => $alive->id,
            'character_name' => $alive->name,
            'gp' => (int) ($alive->sheet['money']['gp'] ?? 0),
            'gold_total' => Wallet::goldTotal($alive->sheet['money'] ?? []),
        ] : null;

        return response()->json([
            'merchant' => $merchant,
            'buyer' => $buyer,
        ]);
    }

    /** Compra un objeto usando exclusivamente monedas literales de Oro (gp) del PJ principal vivo. */
    public function buy(Request $request, ShopItem $item): JsonResponse
    {
        $user = $request->user();

        $result = DB::transaction(function () use ($item, $user) {
            $lockedItem = ShopItem::whereKey($item->id)->lockForUpdate()->firstOrFail();
            $merchant = Merchant::find($lockedItem->merchant_id);

            abort_if(! $merchant || ! $merchant->is_active, 422, 'Este mercader ya levantó campamento y no está atendiendo.');
            abort_if($lockedItem->sold_at !== null, 422, 'Este objeto ya fue comprado por otro aventurero.');

            /** @var Character|null $character */
            $character = $user->characters()
                ->where('is_npc', false)
                ->where('is_dead', false)
                ->lockForUpdate()
                ->first();

            abort_if(! $character, 422, 'Necesitás tener un personaje principal vivo para comprar en la tienda.');

            $sheet = $character->sheet;
            $gp = (int) ($sheet['money']['gp'] ?? 0);

            if ($gp < $lockedItem->price_gp) {
                abort(
                    422,
                    "No te alcanzan las piezas de Oro en mano (tenés {$gp} PO y cuesta {$lockedItem->price_gp} PO). Si tenés Platino o Plata, cambialos primero en tu hoja."
                );
            }

            // Descuenta monedas literales de Oro y agrega el objeto al Equipo de la hoja
            $sheet['money']['gp'] = $gp - $lockedItem->price_gp;
            $line = "- {$lockedItem->name} (comprado a {$merchant->name} por {$lockedItem->price_gp} PO)";
            $currentEquip = trim((string) ($sheet['equipment'] ?? ''));
            $sheet['equipment'] = $currentEquip !== '' ? $currentEquip."\n".$line : $line;

            $character->sheet = $sheet;
            $character->save();

            $lockedItem->sold_at = now();
            $lockedItem->sold_to_character_id = $character->id;
            $lockedItem->sold_to_user_id = $user->id;
            $lockedItem->save();

            $purchase = ShopPurchase::create([
                'merchant_id' => $merchant->id,
                'character_id' => $character->id,
                'user_id' => $user->id,
                'merchant_name' => $merchant->name,
                'character_name' => $character->name,
                'item_name' => $lockedItem->name,
                'item_description' => $lockedItem->description,
                'price_gp' => $lockedItem->price_gp,
                'purchased_at' => now(),
            ]);

            return [
                'purchase' => $purchase,
                'buyer' => [
                    'character_id' => $character->id,
                    'character_name' => $character->name,
                    'gp' => (int) ($character->sheet['money']['gp'] ?? 0),
                    'gold_total' => Wallet::goldTotal($character->sheet['money'] ?? []),
                ],
            ];
        });

        return response()->json($result);
    }

    // ==================== Gestión DM ====================

    public function merchants(): JsonResponse
    {
        if (Merchant::count() === 0) {
            ShopSeeder::ensureInitialMerchant();
        }

        $merchants = Merchant::with(['items' => fn ($q) => $q->whereNull('sold_at')->orderBy('id')])
            ->orderByDesc('is_active')
            ->orderBy('id')
            ->get();

        return response()->json($merchants);
    }

    public function storeMerchant(Request $request): JsonResponse
    {
        $data = $this->validatedMerchant($request);
        $shouldActivate = $request->boolean('is_active', false) || Merchant::count() === 0;

        $merchant = DB::transaction(function () use ($data, $shouldActivate) {
            if ($shouldActivate) {
                Merchant::query()->update(['is_active' => false]);
            }
            $data['is_active'] = $shouldActivate;
            return Merchant::create($data);
        });

        return response()->json($merchant->load('items'), 201);
    }

    public function updateMerchant(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $this->validatedMerchant($request);
        $merchant->update($data);

        return response()->json($merchant->load(['items' => fn ($q) => $q->whereNull('sold_at')->orderBy('id')]));
    }

    public function activateMerchant(Merchant $merchant): JsonResponse
    {
        DB::transaction(function () use ($merchant) {
            Merchant::query()->update(['is_active' => false]);
            $merchant->is_active = true;
            $merchant->save();
        });

        return response()->json($merchant->fresh()->load(['items' => fn ($q) => $q->whereNull('sold_at')->orderBy('id')]));
    }

    public function destroyMerchant(Merchant $merchant): JsonResponse
    {
        $wasActive = $merchant->is_active;
        $merchant->delete();

        if ($wasActive) {
            $next = Merchant::first();
            if ($next) {
                $next->is_active = true;
                $next->save();
            }
        }

        return response()->json(null, 204);
    }

    public function uploadPose(Request $request, Merchant $merchant, string $pose): JsonResponse
    {
        abort_unless(in_array($pose, Merchant::POSES, true), 422, 'Expresión de mercader no válida.');

        $request->validate([
            'image' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:8192'],
        ], [
            'image.mimes' => 'La imagen debe ser PNG, JPG o WebP.',
        ]);

        $merchant->deletePoseFile($pose);
        $poses = $merchant->poses ?? [];
        $poses[$pose] = $request->file('image')->store("merchants/{$merchant->id}", 'public');
        $merchant->poses = $poses;
        $merchant->save();

        return response()->json($merchant);
    }

    public function deletePose(Merchant $merchant, string $pose): JsonResponse
    {
        abort_unless(in_array($pose, Merchant::POSES, true), 422, 'Expresión de mercader no válida.');

        $merchant->deletePoseFile($pose);
        $merchant->save();

        return response()->json($merchant);
    }

    public function storeItem(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $this->validatedItem($request);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('shop-items', 'public');
        }

        $item = $merchant->items()->create($data);

        return response()->json($item, 201);
    }

    public function updateItem(Request $request, ShopItem $item): JsonResponse
    {
        abort_if($item->sold_at !== null, 422, 'No podés editar un objeto que ya fue vendido.');

        $data = $this->validatedItem($request);

        if ($request->boolean('remove_image')) {
            $item->deleteImageFile();
            $data['image_path'] = null;
        }
        if ($request->hasFile('image')) {
            $item->deleteImageFile();
            $data['image_path'] = $request->file('image')->store('shop-items', 'public');
        }

        $item->update($data);

        return response()->json($item);
    }

    public function destroyItem(ShopItem $item): JsonResponse
    {
        $item->delete();

        return response()->json(null, 204);
    }

    public function purchases(): JsonResponse
    {
        return response()->json(
            ShopPurchase::with('user:id,name')->latest('purchased_at')->limit(50)->get()
        );
    }

    // ==================== Validación ====================

    private function validatedMerchant(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'title' => ['nullable', 'string', 'max:120'],
            'rotation_label' => ['nullable', 'string', 'max:80'],
            'voice_pitch' => ['required', Rule::in(Merchant::VOICES)],
            'greeting' => ['required', 'string', 'max:500'],
            'purchase_line' => ['required', 'string', 'max:500'],
            'no_gold_line' => ['required', 'string', 'max:500'],
            'dialogues' => ['nullable', 'array', 'max:20'],
            'dialogues.*.pose' => ['required', Rule::in(Merchant::POSES)],
            'dialogues.*.text' => ['required', 'string', 'max:500'],
        ]);

        $data['dialogues'] = array_values(array_filter(
            $data['dialogues'] ?? [],
            fn ($d) => trim((string) ($d['text'] ?? '')) !== '',
        ));

        return $data;
    }

    private function validatedItem(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'price_gp' => ['required', 'integer', 'min:1', 'max:1000000'],
            'inspect_pose' => ['nullable', Rule::in(Merchant::POSES)],
            'image' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:15360'],
        ], [
            'image.mimes' => 'La imagen del objeto debe ser PNG, JPG o WebP.',
        ]);

        $desc = trim((string) ($data['description'] ?? ''));
        $data['description'] = $desc !== '' ? $desc : "{$data['name']}. Una pieza especial por {$data['price_gp']} PO.";

        return $data;
    }
}
