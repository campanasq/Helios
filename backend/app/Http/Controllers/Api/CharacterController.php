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
        $data = $this->validated($request);
        $data['sheet'] ??= [];
        $character = $request->user()->characters()->create($data);
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

    /**
     * Galería de héroes: todos los personajes con retrato, de todos los jugadores.
     * Solo datos públicos (la hoja completa sigue siendo privada).
     */
    public function gallery(): JsonResponse
    {
        $characters = Character::query()
            ->whereNotNull('avatar_path')
            ->with('user:id,name')
            ->orderByDesc('level')
            ->orderBy('name')
            ->get([
                'id', 'user_id', 'name', 'race', 'class', 'level', 'alignment', 'background',
                'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
                'hit_points', 'armor_class', 'avatar_path',
            ]);

        return response()->json([
            'characters' => $characters,
            'without_portrait' => Character::whereNull('avatar_path')->count(),
        ]);
    }

    /** Sube el avatar: PNG (idealmente con fondo transparente) en proporción 2:4. */
    public function uploadAvatar(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);

        $request->validate([
            'avatar' => [
                'required', 'image', 'mimes:png', 'max:8192',
                'dimensions:ratio=1/2,min_width=160,max_width=2000',
            ],
        ], [
            'avatar.mimes' => 'El retrato debe ser una imagen PNG.',
            'avatar.dimensions' => 'La imagen debe tener proporción 2:4 (vertical, entre 160 y 2000 px de ancho).',
        ]);

        $character->deleteAvatarFile();
        $character->avatar_path = $request->file('avatar')->store('avatars', 'public');
        $character->save();

        return response()->json($character);
    }

    public function deleteAvatar(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);

        $character->deleteAvatarFile();
        $character->avatar_path = null;
        $character->save();

        return response()->json($character);
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
            // El contenido se normaliza en App\Support\CharacterSheet
            'sheet' => ['nullable', 'array'],
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
