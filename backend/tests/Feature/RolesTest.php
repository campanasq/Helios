<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RolesTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(Role $role, array $attrs = []): User
    {
        $u = User::factory()->create();
        $u->forceFill(array_merge(['role' => $role], $attrs))->save();
        return $u->fresh();
    }

    private array $character = [
        'name' => 'Thorin', 'race' => 'Enano', 'class' => 'Guerrero', 'level' => 3,
        'strength' => 16, 'dexterity' => 12, 'constitution' => 15, 'intelligence' => 10,
        'wisdom' => 11, 'charisma' => 8, 'hit_points' => 28, 'armor_class' => 16,
    ];

    private array $mission = [
        'title' => 'La cripta', 'description' => 'Limpiar la cripta.', 'difficulty' => 'media',
        'status' => 'abierta', 'min_level' => 1,
    ];

    public function test_register_puts_user_in_queue_and_login_works(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Ana', 'email' => 'ana@test.com', 'password' => 'secret123', 'password_confirmation' => 'secret123',
        ])->assertCreated()->assertJsonPath('user.role', 'en_fila')->assertJsonStructure(['token']);

        $this->postJson('/api/login', ['email' => 'ana@test.com', 'password' => 'secret123'])->assertOk();
        $this->postJson('/api/login', ['email' => 'ana@test.com', 'password' => 'mala'])->assertStatus(422);
    }

    public function test_en_fila_cannot_access_game(): void
    {
        Sanctum::actingAs($this->makeUser(Role::EnFila));
        $this->getJson('/api/me')->assertOk();
        $this->getJson('/api/characters')->assertForbidden();
        $this->getJson('/api/missions')->assertForbidden();
    }

    public function test_jugador_permissions(): void
    {
        $j = $this->makeUser(Role::Jugador);
        Sanctum::actingAs($j);
        $this->postJson('/api/characters', $this->character)->assertCreated();
        $this->getJson('/api/characters')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/missions')->assertOk();
        $this->postJson('/api/missions', $this->mission)->assertForbidden();
        $this->getJson('/api/all-characters')->assertForbidden();
        $this->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_dm_permissions(): void
    {
        $j = $this->makeUser(Role::Jugador);
        $j->characters()->create($this->character);
        Sanctum::actingAs($this->makeUser(Role::DungeonMaster));
        $this->getJson('/api/characters')->assertOk()->assertJsonCount(0);
        $this->getJson('/api/all-characters')->assertOk()->assertJsonCount(1);
        $id = $this->postJson('/api/missions', $this->mission)->assertCreated()->json('id');
        $this->putJson("/api/missions/$id", [...$this->mission, 'status' => 'en_curso'])->assertOk();
        $this->deleteJson("/api/missions/$id")->assertNoContent();
    }

    public function test_cannot_edit_others_character(): void
    {
        $owner = $this->makeUser(Role::Jugador);
        $c = $owner->characters()->create($this->character);
        Sanctum::actingAs($this->makeUser(Role::DungeonMaster));
        $this->putJson("/api/characters/{$c->id}", $this->character)->assertForbidden();
        $this->getJson("/api/characters/{$c->id}")->assertOk();
    }

    public function test_admin_accepts_user_but_cannot_manage_admins(): void
    {
        $admin = $this->makeUser(Role::Jugador, ['is_admin' => true]);
        $queued = $this->makeUser(Role::EnFila);
        Sanctum::actingAs($admin);
        $this->patchJson("/api/admin/users/{$queued->id}/role", ['role' => 'jugador'])->assertOk()->assertJsonPath('role', 'jugador');
        $this->patchJson("/api/admin/users/{$queued->id}/admin", ['is_admin' => true])->assertForbidden();
        $this->patchJson("/api/admin/users/{$queued->id}/active", ['is_active' => false])->assertForbidden();
    }

    public function test_superadmin_assigns_admin_and_deactivates(): void
    {
        $this->seed();
        $super = User::where('is_superadmin', true)->first();
        $u = $this->makeUser(Role::Jugador);
        Sanctum::actingAs($super);
        $this->patchJson("/api/admin/users/{$u->id}/admin", ['is_admin' => true])->assertOk()->assertJsonPath('is_admin', true);
        $this->patchJson("/api/admin/users/{$u->id}/active", ['is_active' => false])->assertOk();
        $this->patchJson("/api/admin/users/{$super->id}/admin", ['is_admin' => false])->assertForbidden();

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => $u->email, 'password' => 'password'])->assertStatus(422);
    }
}
