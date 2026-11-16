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
        $this->postJson('/api/characters', [...$this->base, 'name' => 'Sin retrato']);
        $this->post("/api/characters/$withPortrait/avatar", ['avatar' => UploadedFile::fake()->image('a.png', 400, 800)], ['Accept' => 'application/json']);

        $this->player(); // otro jugador también la ve
        $res = $this->getJson('/api/gallery')->assertOk()
            ->assertJsonCount(1, 'characters')
            ->assertJsonPath('without_portrait', 1)
            ->assertJsonPath('characters.0.name', 'Lyra');
        $this->assertArrayNotHasKey('sheet', $res->json('characters.0'));
        $this->assertArrayNotHasKey('backstory', $res->json('characters.0'));
        $this->assertNotNull($res->json('characters.0.avatar_url'));
    }

    public function test_queued_user_cannot_see_gallery(): void
    {
        $u = User::factory()->create();
        Sanctum::actingAs($u->fresh());
        $this->getJson('/api/gallery')->assertForbidden();
    }
}
