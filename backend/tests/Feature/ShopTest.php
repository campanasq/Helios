<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShopTest extends TestCase
{
    use RefreshDatabase;

    private array $charBase = [
        'name' => 'Garrick', 'race' => 'Humano', 'class' => 'Guerrero', 'level' => 3,
        'strength' => 16, 'dexterity' => 12, 'constitution' => 14, 'intelligence' => 10,
        'wisdom' => 11, 'charisma' => 10, 'hit_points' => 28, 'armor_class' => 16,
    ];

    private function userWithRole(Role $role): User
    {
        $u = User::factory()->create();
        $u->forceFill(['role' => $role])->save();
        $u = $u->fresh();
        Sanctum::actingAs($u);
        return $u;
    }

    public function test_shop_auto_seeds_initial_merchant_and_items(): void
    {
        $this->userWithRole(Role::Jugador);
        $res = $this->getJson('/api/shop')->assertOk();

        $this->assertStringContainsString('Bram', $res->json('merchant.name'));
        $this->assertGreaterThanOrEqual(3, count($res->json('merchant.available_items')));
        $this->assertGreaterThanOrEqual(4, count($res->json('merchant.dialogues')));
    }

    public function test_buy_requires_literal_gold_removes_item_and_adds_to_equipment(): void
    {
        $player = $this->userWithRole(Role::Jugador);
        $charId = $this->postJson('/api/characters', $this->charBase)->assertCreated()->json('id');

        $shop = $this->getJson('/api/shop')->assertOk()->json();
        $item = $shop['merchant']['available_items'][0]; // 15 PO
        $itemId = $item['id'];
        $price = $item['price_gp'];

        // DM le da Platino pero 0 monedas literales de Oro → la compra debe rechazarse hasta que convierta
        $dm = $this->userWithRole(Role::DungeonMaster);
        $this->postJson("/api/characters/$charId/wallet/adjust", ['pp' => 5])->assertOk();

        Sanctum::actingAs($player->fresh());
        $this->postJson("/api/shop/items/$itemId/buy")->assertStatus(422);

        // El jugador convierte 2 Platino a 20 Oro y compra
        $this->postJson("/api/characters/$charId/wallet/convert", ['from' => 'pp', 'to' => 'gp', 'amount' => 2])
            ->assertOk();

        $buyRes = $this->postJson("/api/shop/items/$itemId/buy")->assertOk();
        $this->assertSame(20 - $price, $buyRes->json('buyer.gp'));

        // El objeto desaparece de la tienda y no puede volver a comprarse
        $afterShop = $this->getJson('/api/shop')->assertOk()->json();
        $remainingIds = collect($afterShop['merchant']['available_items'])->pluck('id')->all();
        $this->assertNotContains($itemId, $remainingIds);
        $this->postJson("/api/shop/items/$itemId/buy")->assertStatus(422);

        // Se sumó automáticamente al campo Equipo de la hoja
        $char = $this->getJson("/api/characters/$charId")->assertOk()->json();
        $this->assertStringContainsString($item['name'], $char['sheet']['equipment']);

        // El DM ve la compra en el historial de ventas
        Sanctum::actingAs($dm->fresh());
        $this->getJson('/api/shop/purchases')->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.item_name', $item['name'])
            ->assertJsonPath('0.price_gp', $price);
    }

    public function test_dm_can_manage_merchants_poses_and_items_while_player_cannot(): void
    {
        Storage::fake('public');

        $this->userWithRole(Role::Jugador);
        $this->getJson('/api/shop/merchants')->assertForbidden();
        $this->postJson('/api/shop/merchants', ['name' => 'Intruso'])->assertForbidden();

        $this->userWithRole(Role::DungeonMaster);

        $merchantId = $this->postJson('/api/shop/merchants', [
            'name' => 'Vespera la Alquimista',
            'title' => 'Tónicos de Medianoche',
            'rotation_label' => 'Semana 3–4',
            'voice_pitch' => 'mystic',
            'is_active' => true,
            'greeting' => 'Pasa, viajero...',
            'purchase_line' => 'Un trato justo.',
            'no_gold_line' => 'Te falta oro.',
            'dialogues' => [['pose' => 'explaining', 'text' => 'Recolecto hongos lunares.']],
        ])->assertCreated()->json('id');

        // Subir pose PNG
        $poseRes = $this->post("/api/shop/merchants/$merchantId/poses/excited", [
            'image' => UploadedFile::fake()->image('excited.png', 400, 400),
        ], ['Accept' => 'application/json'])->assertOk();
        $this->assertNotNull($poseRes->json('pose_urls.excited'));

        // Crear, editar y borrar objeto con imagen
        $itemRes = $this->post("/api/shop/merchants/$merchantId/items", [
            'name' => 'Elixir de Sombra',
            'description' => 'Te oculta en penumbras.',
            'price_gp' => 40,
            'inspect_pose' => 'explaining',
            'image' => UploadedFile::fake()->image('elixir.png', 200, 200),
        ], ['Accept' => 'application/json'])->assertCreated();

        $itemId = $itemRes->json('id');
        $this->assertNotNull($itemRes->json('image_url'));

        $this->post("/api/shop/items/$itemId", [
            'name' => 'Elixir de Sombra Mayor',
            'description' => 'Dura el doble.',
            'price_gp' => 55,
            'inspect_pose' => 'excited',
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('price_gp', 55);

        $this->deleteJson("/api/shop/items/$itemId")->assertNoContent();
    }
}
