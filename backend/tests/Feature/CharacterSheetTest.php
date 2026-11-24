<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CharacterSheetTest extends TestCase
{
    use RefreshDatabase;

    private array $base = [
        'name' => 'Lyra', 'race' => 'Elfo', 'class' => 'Mago', 'level' => 5,
        'strength' => 8, 'dexterity' => 14, 'constitution' => 12, 'intelligence' => 18,
        'wisdom' => 12, 'charisma' => 10, 'hit_points' => 27, 'armor_class' => 12,
    ];

    private function player(): User
    {
        $u = User::factory()->create();
        $u->forceFill(['role' => Role::Jugador])->save();
        $u = $u->fresh();
        Sanctum::actingAs($u);
        return $u;
    }

    public function test_sheet_is_normalized(): void
    {
        $this->player();
        $res = $this->postJson('/api/characters', [...$this->base, 'sheet' => [
            'skills' => ['arcana' => 2, 'stealth' => 9, 'hacking' => 1],
            'saving_throws' => ['intelligence' => true],
            'attacks' => [['name' => 'Daga', 'bonus' => '+4', 'damage' => '1d4+2 perforante'], ['name' => '']],
            'spellcasting' => ['ability' => 'intelligence', 'slots' => [['total' => 4, 'used' => 9]],
                'spells' => [['level' => 1, 'name' => 'Proyectil mágico', 'prepared' => true]]],
            'evil' => '<script>',
        ]])->assertCreated();

        $sheet = $res->json('sheet');
        $this->assertSame(2, $sheet['skills']['arcana']);
        $this->assertSame(2, $sheet['skills']['stealth']); // acotado a 0..2
        $this->assertArrayNotHasKey('hacking', $sheet['skills']);
        $this->assertArrayNotHasKey('evil', $sheet);
        $this->assertCount(1, $sheet['attacks']);
        $this->assertSame(['total' => 4, 'used' => 4], $sheet['spellcasting']['slots'][0]);
        $this->assertCount(9, $sheet['spellcasting']['slots']);
        $this->assertTrue($sheet['saving_throws']['intelligence']);
        $this->assertFalse($sheet['saving_throws']['strength']);
    }

    public function test_avatar_must_be_png_2_by_4(): void
    {
        Storage::fake('public');
        $this->player();
        $id = $this->postJson('/api/characters', $this->base)->json('id');
        $upload = fn ($file) => $this->post("/api/characters/$id/avatar", ['avatar' => $file], ['Accept' => 'application/json']);

        $upload(UploadedFile::fake()->image('a.png', 400, 1000))->assertStatus(422);  // 2:5 ya no vale
        $upload(UploadedFile::fake()->image('a.jpg', 400, 800))->assertStatus(422)    // JPG no
            ->assertJsonPath('errors.avatar.0', 'El retrato debe ser una imagen PNG.');

        $res = $upload(UploadedFile::fake()->image('a.png', 400, 800))->assertOk();
        $this->assertNotNull($res->json('avatar_url'));
        $this->assertCount(1, Storage::disk('public')->files('avatars'));

        $this->deleteJson("/api/characters/$id")->assertNoContent();
        $this->assertCount(0, Storage::disk('public')->files('avatars'));
    }

    public function test_cannot_change_others_avatar(): void
    {
        Storage::fake('public');
        $this->player();
        $id = $this->postJson('/api/characters', $this->base)->json('id');
        $this->player();
        $this->post("/api/characters/$id/avatar", ['avatar' => UploadedFile::fake()->image('a.png', 400, 800)], ['Accept' => 'application/json'])
            ->assertForbidden();
    }

    public function test_gallery_shows_only_portraits_and_public_data(): void
    {
        Storage::fake('public');
        $this->player();
        $withPortrait = $this->postJson('/api/characters', $this->base)->json('id');
        $this->post("/api/characters/$withPortrait/avatar", ['avatar' => UploadedFile::fake()->image('a.png', 400, 800)], ['Accept' => 'application/json']);

        $this->player(); // otro jugador crea un personaje sin retrato y también ve la galería
        $this->postJson('/api/characters', [...$this->base, 'name' => 'Sin retrato'])->assertCreated();

        $res = $this->getJson('/api/gallery')->assertOk()
            ->assertJsonCount(1, 'characters')
            ->assertJsonPath('without_portrait', 1)
            ->assertJsonPath('characters.0.name', 'Lyra')
            ->assertJsonPath('characters.0.is_dead', false)
            ->assertJsonPath('characters.0.is_npc', false);
        $this->assertArrayNotHasKey('sheet', $res->json('characters.0'));
        $this->assertNull($res->json('characters.0.backstory'));
        $this->assertNotNull($res->json('characters.0.avatar_url'));
    }

    public function test_player_can_only_have_one_alive_character_at_a_time(): void
    {
        $this->player();
        $first = $this->postJson('/api/characters', $this->base)->assertCreated()->json('id');

        // Segundo personaje vivo bloqueado para jugador
        $this->postJson('/api/characters', [...$this->base, 'name' => 'Segundo'])->assertStatus(422);

        // Tras morir definitivamente, puede crear un nuevo personaje vivo
        $this->postJson("/api/characters/$first/kill")
            ->assertOk()
            ->assertJsonPath('is_dead', true)
            ->assertJsonPath('sheet.death_saves.failures', 3)
            ->assertJsonPath('sheet.hp_current', 0);

        $this->postJson('/api/characters', [...$this->base, 'name' => 'Heredero'])
            ->assertCreated()
            ->assertJsonPath('is_dead', false);
    }

    public function test_dm_can_have_only_one_alive_playable_and_unlimited_npcs(): void
    {
        $dm = User::factory()->create();
        $dm->forceFill(['role' => Role::DungeonMaster])->save();
        Sanctum::actingAs($dm->fresh());

        // 1 solo PJ principal jugable vivo
        $mainId = $this->postJson('/api/characters', $this->base)
            ->assertCreated()
            ->assertJsonPath('is_npc', false)
            ->json('id');

        // Segundo PJ jugable vivo bloqueado también para DM
        $this->postJson('/api/characters', [...$this->base, 'name' => 'Segundo principal'])->assertStatus(422);

        // Puede crear todos los NPCs que quiera
        $npcId = $this->postJson('/api/characters', [...$this->base, 'name' => 'Tabernero', 'is_npc' => true])
            ->assertCreated()
            ->assertJsonPath('is_npc', true)
            ->json('id');
        $this->postJson('/api/characters', [...$this->base, 'name' => 'Villano', 'is_npc' => true])
            ->assertCreated()
            ->assertJsonPath('is_npc', true);

        // Los NPCs no usan muerte definitiva bloqueada y siguen editables incluso con 3 fallos
        $this->postJson("/api/characters/$npcId/kill")->assertStatus(422);
        $this->putJson("/api/characters/$npcId", [
            ...$this->base,
            'name' => 'Tabernero herido',
            'sheet' => ['death_saves' => ['failures' => 3]],
        ])->assertOk()->assertJsonPath('sheet.death_saves.failures', 3);

        // Si muere el PJ principal del DM, puede crear uno nuevo
        $this->postJson("/api/characters/$mainId/kill")->assertOk();
        $this->postJson('/api/characters', [...$this->base, 'name' => 'Nuevo principal'])->assertCreated();
    }

    public function test_player_cannot_create_npc_or_access_all_characters(): void
    {
        $this->player();
        $this->postJson('/api/characters', [...$this->base, 'is_npc' => true])->assertForbidden();
        $this->getJson('/api/all-characters')->assertForbidden();
    }

    public function test_gallery_respects_visibility_for_npcs_and_players(): void
    {
        Storage::fake('public');

        $dm = User::factory()->create();
        $dm->forceFill(['role' => Role::DungeonMaster])->save();
        Sanctum::actingAs($dm->fresh());

        $npcId = $this->postJson('/api/characters', [
            ...$this->base,
            'name' => 'Encapuchado',
            'is_npc' => true,
            'backstory' => 'Secreto del DM',
        ])->assertCreated()->json('id');
        $this->post("/api/characters/$npcId/avatar", ['avatar' => UploadedFile::fake()->image('npc.png', 400, 800)], ['Accept' => 'application/json'])
            ->assertOk();

        // Jugador crea su PJ ocultando stats/vitales y revelando historia
        $this->player();
        $pjId = $this->postJson('/api/characters', [
            ...$this->base,
            'name' => 'Alden',
            'backstory' => 'Nacido en el norte.',
            'gallery_visibility' => [
                'stats' => false,
                'vitals' => false,
                'backstory' => true,
            ],
        ])->assertCreated()->json('id');
        $this->post("/api/characters/$pjId/avatar", ['avatar' => UploadedFile::fake()->image('pj.png', 400, 800)], ['Accept' => 'application/json'])
            ->assertOk();

        $res = $this->getJson('/api/gallery')->assertOk()->assertJsonCount(2, 'characters');
        $chars = collect($res->json('characters'))->keyBy('name');

        // PJ jugable: backstory revelada, stats y vitals ocultos
        $this->assertSame('Nacido en el norte.', $chars['Alden']['backstory']);
        $this->assertNull($chars['Alden']['strength']);
        $this->assertNull($chars['Alden']['armor_class']);
        $this->assertSame('Elfo', $chars['Alden']['race']);

        // NPC: por defecto solo nombre, retrato y raza visibles
        $this->assertTrue($chars['Encapuchado']['is_npc']);
        $this->assertSame('Elfo', $chars['Encapuchado']['race']);
        $this->assertNull($chars['Encapuchado']['class']);
        $this->assertNull($chars['Encapuchado']['level']);
        $this->assertNull($chars['Encapuchado']['strength']);
        $this->assertNull($chars['Encapuchado']['user']);
        $this->assertNull($chars['Encapuchado']['backstory']);

        // DM revela clase/nivel y stats del NPC, pero oculta el nombre
        Sanctum::actingAs($dm->fresh());
        $this->putJson("/api/characters/$npcId", [
            ...$this->base,
            'name' => 'Encapuchado',
            'gallery_visibility' => ['name' => false, 'class_level' => true, 'stats' => true],
        ])->assertOk();

        $after = collect($this->getJson('/api/gallery')->assertOk()->json('characters'))->keyBy('id');
        $this->assertNull($after[$npcId]['name']);
        $this->assertSame('Mago', $after[$npcId]['class']);
        $this->assertSame(5, $after[$npcId]['level']);
        $this->assertSame(18, $after[$npcId]['intelligence']);
    }

    public function test_other_dm_cannot_see_npcs_in_all_characters_or_open_their_sheet(): void
    {
        $dm1 = User::factory()->create();
        $dm1->forceFill(['role' => Role::DungeonMaster])->save();
        Sanctum::actingAs($dm1->fresh());

        $dm1Playable = $this->postJson('/api/characters', [...$this->base, 'name' => 'Héroe DM1'])->assertCreated()->json('id');
        $dm1Npc = $this->postJson('/api/characters', [...$this->base, 'name' => 'Jefe Secreto', 'is_npc' => true])->assertCreated()->json('id');

        $dm2 = User::factory()->create();
        $dm2->forceFill(['role' => Role::DungeonMaster])->save();
        Sanctum::actingAs($dm2->fresh());

        // "Personajes de los usuarios" solo lista jugables (no NPCs)
        $all = $this->getJson('/api/all-characters')->assertOk()->json();
        $this->assertCount(1, $all);
        $this->assertSame($dm1Playable, $all[0]['id']);

        // DM2 puede abrir la hoja del PJ jugable de DM1, pero NO la de su NPC
        $this->getJson("/api/characters/$dm1Playable")->assertOk();
        $this->getJson("/api/characters/$dm1Npc")->assertForbidden();
    }

    public function test_dead_character_is_readonly_and_visible_in_gallery(): void
    {
        Storage::fake('public');
        $this->player();
        $id = $this->postJson('/api/characters', $this->base)->assertCreated()->json('id');
        $this->post("/api/characters/$id/avatar", ['avatar' => UploadedFile::fake()->image('a.png', 400, 800)], ['Accept' => 'application/json'])
            ->assertOk();

        $this->postJson("/api/characters/$id/kill")->assertOk();

        // No se puede editar, volver a matar, ni cambiar/borrar avatar
        $this->putJson("/api/characters/$id", [...$this->base, 'name' => 'Revivido'])->assertStatus(422);
        $this->postJson("/api/characters/$id/kill")->assertStatus(422);
        $this->post("/api/characters/$id/avatar", ['avatar' => UploadedFile::fake()->image('b.png', 400, 800)], ['Accept' => 'application/json'])
            ->assertStatus(422);
        $this->deleteJson("/api/characters/$id/avatar")->assertStatus(422);

        // Sigue apareciendo en Mis Personajes y Galería marcado como muerto
        $this->getJson('/api/characters')->assertOk()->assertJsonPath('0.is_dead', true);
        $this->getJson('/api/gallery')->assertOk()->assertJsonPath('characters.0.is_dead', true);
    }

    public function test_queued_user_cannot_see_gallery(): void
    {
        $u = User::factory()->create();
        Sanctum::actingAs($u->fresh());
        $this->getJson('/api/gallery')->assertForbidden();
    }

    public function test_character_multiple_images_and_gallery_selection(): void
    {
        Storage::fake('public');
        $this->player();
        $id = $this->postJson('/api/characters', $this->base)->assertCreated()->json('id');

        // Subir retrato principal + 2 imágenes extra (una visible, una oculta)
        $this->post("/api/characters/$id/avatar", ['avatar' => UploadedFile::fake()->image('main.png', 400, 800)], ['Accept' => 'application/json'])
            ->assertOk();

        $img1 = $this->post("/api/characters/$id/images", [
            'image' => UploadedFile::fake()->image('armor.png', 400, 800),
            'caption' => 'Con armadura',
            'show_in_gallery' => true,
        ], ['Accept' => 'application/json'])->assertCreated()->json('id');

        $img2 = $this->post("/api/characters/$id/images", [
            'image' => UploadedFile::fake()->image('secret.png', 400, 800),
            'caption' => 'Secreta',
            'show_in_gallery' => false,
        ], ['Accept' => 'application/json'])->assertCreated()->json('id');

        // En la galería aparecen solo las 2 habilitadas (avatar + img1)
        $res = $this->getJson('/api/gallery')->assertOk();
        $this->assertCount(2, $res->json('characters.0.gallery_images'));
        $this->assertSame('avatar', $res->json('characters.0.gallery_images.0.id'));
        $this->assertSame('Con armadura', $res->json('characters.0.gallery_images.1.caption'));

        // Habilitar img2 y deshabilitar avatar en galería
        $this->patchJson("/api/characters/$id/images/$img2", ['show_in_gallery' => true, 'caption' => 'Forma final'])
            ->assertOk()
            ->assertJsonPath('show_in_gallery', true)
            ->assertJsonPath('caption', 'Forma final');

        $this->putJson("/api/characters/$id", [...$this->base, 'gallery_visibility' => ['avatar' => false]])
            ->assertOk();

        $res2 = $this->getJson('/api/gallery')->assertOk();
        $this->assertCount(2, $res2->json('characters.0.gallery_images'));
        $this->assertSame($img1, $res2->json('characters.0.gallery_images.0.id'));
        $this->assertSame($img2, $res2->json('characters.0.gallery_images.1.id'));

        // Borrar img1 elimina el archivo del disco
        $this->assertCount(2, Storage::disk('public')->files('character-images'));
        $this->deleteJson("/api/characters/$id/images/$img1")->assertNoContent();
        $this->assertCount(1, Storage::disk('public')->files('character-images'));

        // Borrar el personaje elimina también el resto de archivos de imágenes extra
        $this->deleteJson("/api/characters/$id")->assertNoContent();
        $this->assertCount(0, Storage::disk('public')->files('character-images'));
    }

    public function test_wallet_is_dm_controlled_convertible_and_shown_in_profile_gold(): void
    {
        $player = $this->player();

        // Jugador intenta inyectarse oro al crear y al editar: siempre queda en 0
        $id = $this->postJson('/api/characters', [
            ...$this->base,
            'sheet' => ['money' => ['gp' => 9999, 'pp' => 50]],
        ])->assertCreated()->json('id');

        $this->getJson("/api/characters/$id")->assertOk()->assertJsonPath('sheet.money.gp', 0);
        $this->getJson('/api/me')->assertOk()->assertJsonPath('gold_total', 0);

        $this->putJson("/api/characters/$id", [
            ...$this->base,
            'sheet' => ['money' => ['gp' => 500]],
        ])->assertOk()->assertJsonPath('sheet.money.gp', 0);

        // Jugador no puede usar el endpoint de ajuste del DM
        $this->postJson("/api/characters/$id/wallet/adjust", ['gp' => 100])->assertForbidden();

        // DM le entrega 1 Platino, 12 Oro, 5 Plata y 25 Cobre (= 22.75 PO)
        $dm = User::factory()->create();
        $dm->forceFill(['role' => Role::DungeonMaster])->save();
        Sanctum::actingAs($dm->fresh());

        $this->postJson("/api/characters/$id/wallet/adjust", [
            'pp' => 1, 'gp' => 12, 'sp' => 5, 'cp' => 25,
        ])->assertOk()
            ->assertJsonPath('sheet.money.pp', 1)
            ->assertJsonPath('sheet.money.gp', 12)
            ->assertJsonPath('sheet.money.sp', 5)
            ->assertJsonPath('sheet.money.cp', 25);

        // DM no puede dejar una moneda en negativo
        $this->postJson("/api/characters/$id/wallet/adjust", ['pp' => -2])->assertStatus(422);

        // El oro del NPC del DM no se suma al gold_total de perfil del DM
        $npcId = $this->postJson('/api/characters', [...$this->base, 'name' => 'Mercader', 'is_npc' => true])
            ->assertCreated()->json('id');
        $this->postJson("/api/characters/$npcId/wallet/adjust", ['gp' => 999])->assertOk();
        $this->getJson('/api/me')->assertOk()->assertJsonPath('gold_total', 0);

        // El jugador ve su total equivalente en oro en /api/me (10 + 12 + 0.5 + 0.25 = 22.75)
        Sanctum::actingAs($player->fresh());
        $this->getJson('/api/me')->assertOk()->assertJsonPath('gold_total', 22.75);

        // Jugador convierte 1 Platino → 10 Oro (mantiene el mismo total de 22.75 PO)
        $this->postJson("/api/characters/$id/wallet/convert", [
            'from' => 'pp', 'to' => 'gp', 'amount' => 1,
        ])->assertOk()
            ->assertJsonPath('sheet.money.pp', 0)
            ->assertJsonPath('sheet.money.gp', 22);
        $this->getJson('/api/me')->assertOk()->assertJsonPath('gold_total', 22.75);

        // Conversión inválida (5 plata a oro no es múltiplo de 10)
        $this->postJson("/api/characters/$id/wallet/convert", [
            'from' => 'sp', 'to' => 'gp', 'amount' => 5,
        ])->assertStatus(422);

        // Compactar monedas: 22 gp + 5 sp + 25 cp = 2275 cp → 2 pp, 2 gp, 7 sp, 5 cp
        $this->postJson("/api/characters/$id/wallet/convert", ['compact' => true])
            ->assertOk()
            ->assertJsonPath('sheet.money.pp', 2)
            ->assertJsonPath('sheet.money.gp', 2)
            ->assertJsonPath('sheet.money.sp', 7)
            ->assertJsonPath('sheet.money.cp', 5);
        $this->getJson('/api/me')->assertOk()->assertJsonPath('gold_total', 22.75);

        // Si el personaje muere, el oro se pierde con él y /api/me vuelve a 0
        $this->postJson("/api/characters/$id/kill")->assertOk();
        $this->getJson('/api/me')->assertOk()->assertJsonPath('gold_total', 0);
        $this->postJson("/api/characters/$id/wallet/convert", ['compact' => true])->assertStatus(422);

        Sanctum::actingAs($dm->fresh());
        $this->postJson("/api/characters/$id/wallet/adjust", ['gp' => 5])->assertStatus(422);
    }
}
