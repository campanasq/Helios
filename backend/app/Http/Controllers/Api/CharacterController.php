<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacterController extends Controller
{
    /** "Mis Personajes" */
    public function index(Request $request): JsonResponse
    {
        return response()->json($request->user()->characters()->latest()->get());
    }

    /** "Personajes de los usuarios" (solo Dungeon Master) */
    public function all(): JsonResponse
    {
        return response()->json(
            Character::with('user:id,name,email')->latest()->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $character = $request->user()->characters()->create($this->validated($request));
        return response()->json($character, 201);
    }

    public function show(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwnerOrDm($request, $character);
        return response()->json($character->load('user:id,name'));
    }

    public function update(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $character->update($this->validated($request));
        return response()->json($character);
    }

    public function destroy(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $character->delete();
        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        $stat = ['required', 'integer', 'min:1', 'max:30'];

        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'race' => ['required', 'string', 'max:50'],
            'class' => ['required', 'string', 'max:50'],
            'level' => ['required', 'integer', 'min:1', 'max:20'],
            'alignment' => ['nullable', 'string', 'max:50'],
            'background' => ['nullable', 'string', 'max:100'],
            'strength' => $stat,
            'dexterity' => $stat,
            'constitution' => $stat,
            'intelligence' => $stat,
            'wisdom' => $stat,
            'charisma' => $stat,
            'hit_points' => ['required', 'integer', 'min:1', 'max:999'],
            'armor_class' => ['required', 'integer', 'min:1', 'max:40'],
            'backstory' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    private function authorizeOwner(Request $request, Character $character): void
    {
        abort_unless($character->user_id === $request->user()->id, 403, 'Este personaje no es tuyo.');
    }

    private function authorizeOwnerOrDm(Request $request, Character $character): void
    {
        $user = $request->user();
        abort_unless(
            $character->user_id === $user->id || $user->hasRole(\App\Enums\Role::DungeonMaster),
            403,
            'Este personaje no es tuyo.'
        );
    }
}
