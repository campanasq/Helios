<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\CharacterImage;
use App\Support\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacterController extends Controller
{
    /** "Mis Personajes" */
    public function index(Request $request): JsonResponse
    {
        return response()->json($request->user()->characters()->latest()->get());
    }

    /** "Personajes de los usuarios" (solo Dungeon Master, solo personajes jugables; nunca NPCs) */
    public function all(): JsonResponse
    {
        return response()->json(
            Character::where('is_npc', false)->with('user:id,name,email')->latest()->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $isNpc = $request->boolean('is_npc', false);

        if ($isNpc && ! $user->hasRole(Role::DungeonMaster)) {
            abort(403, 'Solo un Dungeon Master puede crear NPCs.');
        }

        // Todos los usuarios (jugadores y DMs) pueden tener como máximo 1 personaje jugable vivo
        if (! $isNpc && $user->characters()->where('is_npc', false)->where('is_dead', false)->exists()) {
            abort(422, 'Ya tienes un personaje jugable vivo. Solo puedes tener un personaje principal vivo a la vez.');
        }

        $data = $this->validated($request);
        $data['sheet'] ??= [];
        // Todo personaje nace con 0 monedas (solo un DM puede sumar/restar dinero luego)
        $data['sheet']['money'] = Wallet::zero();

        $character = new Character();
        $character->user_id = $user->id;
        $character->is_npc = $isNpc;
        $character->fill($data);
        if (! array_key_exists('gallery_visibility', $data) || $data['gallery_visibility'] === null) {
            $character->gallery_visibility = null;
        }
        $character->save();

        return response()->json($character->load('images'), 201);
    }

    public function show(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwnerOrDm($request, $character);
        return response()->json($character->load(['user:id,name', 'images']));
    }

    public function update(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $this->ensureAlive($character);
        $data = $this->validated($request);
        // En personajes jugables la clase se define al crearlo y no puede cambiarse luego
        if (! $character->is_npc) {
            $data['class'] = $character->class;
        }
        // El dinero no se edita desde el formulario general de la hoja
        if (array_key_exists('sheet', $data) && is_array($data['sheet'])) {
            $data['sheet']['money'] = $character->sheet['money'];
        }
        $character->update($data);
        return response()->json($character->load(['user:id,name', 'images']));
    }

    public function destroy(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $character->delete();
        return response()->json(null, 204);
    }

    /** Marca definitivamente como muerto al personaje jugable (al llegar a 3 fallos de salvación de muerte). */
    public function kill(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        abort_if($character->is_npc, 422, 'Los NPCs no tienen muerte definitiva bloqueada.');
        $this->ensureAlive($character);

        $sheet = $character->sheet;
        $sheet['death_saves']['failures'] = 3;
        $sheet['hp_current'] = 0;

        $character->sheet = $sheet;
        $character->is_dead = true;
        $character->died_at = now();
        $character->save();

        return response()->json($character->load(['user:id,name', 'images']));
    }

    /**
     * Galería de personajes: todos los personajes jugables y NPCs que tengan al menos una imagen
     * habilitada para galería (retrato principal o imágenes adicionales).
     * Filtra los datos públicos según las preferencias de visibilidad de cada dueño/DM.
     */
    public function gallery(): JsonResponse
    {
        $all = Character::query()
            ->with(['user:id,name', 'images'])
            ->orderBy('is_npc')
            ->orderBy('is_dead')
            ->orderByDesc('level')
            ->orderBy('name')
            ->get();

        $characters = [];
        $withoutImages = 0;

        foreach ($all as $c) {
            $v = $c->gallery_visibility;
            $galleryImages = [];

            if ($c->avatar_path && $v['avatar']) {
                $galleryImages[] = [
                    'id' => 'avatar',
                    'url' => $c->avatar_url,
                    'caption' => null,
                ];
            }

            foreach ($c->images as $img) {
                if ($img->show_in_gallery) {
                    $galleryImages[] = [
                        'id' => $img->id,
                        'url' => $img->url,
                        'caption' => $img->caption,
                    ];
                }
            }

            if (count($galleryImages) === 0) {
                $withoutImages++;
                continue;
            }

            $characters[] = [
                'id' => $c->id,
                'user_id' => $c->user_id,
                'name' => $v['name'] ? $c->name : null,
                'avatar_url' => $galleryImages[0]['url'],
                'gallery_images' => $galleryImages,
                'is_dead' => $c->is_dead,
                'died_at' => $c->died_at,
                'is_npc' => $c->is_npc,
                'gallery_visibility' => $v,
                'race' => $v['race'] ? $c->race : null,
                'class' => $v['class_level'] ? $c->class : null,
                'level' => $v['class_level'] ? $c->level : null,
                'alignment' => $v['alignment'] ? $c->alignment : null,
                'background' => $v['background'] ? $c->background : null,
                'armor_class' => $v['vitals'] ? $c->armor_class : null,
                'hit_points' => $v['vitals'] ? $c->hit_points : null,
                'strength' => $v['stats'] ? $c->strength : null,
                'dexterity' => $v['stats'] ? $c->dexterity : null,
                'constitution' => $v['stats'] ? $c->constitution : null,
                'intelligence' => $v['stats'] ? $c->intelligence : null,
                'wisdom' => $v['stats'] ? $c->wisdom : null,
                'charisma' => $v['stats'] ? $c->charisma : null,
                'backstory' => $v['backstory'] ? $c->backstory : null,
                'user' => $v['owner'] ? $c->user : null,
            ];
        }

        return response()->json([
            'characters' => $characters,
            'without_portrait' => $withoutImages,
        ]);
    }

    /** Sube el avatar: PNG (idealmente con fondo transparente) en proporción 2:4. */
    public function uploadAvatar(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $this->ensureAlive($character);

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

        return response()->json($character->load(['user:id,name', 'images']));
    }

    public function deleteAvatar(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $this->ensureAlive($character);

        $character->deleteAvatarFile();
        $character->avatar_path = null;
        $character->save();

        return response()->json($character->load(['user:id,name', 'images']));
    }

    /** Sube una imagen adicional del personaje (PNG 2:4, máx. 8 por personaje). */
    public function uploadImage(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $this->ensureAlive($character);

        abort_if($character->images()->count() >= 8, 422, 'Puedes subir hasta 8 imágenes adicionales por personaje.');

        $request->validate([
            'image' => [
                'required', 'image', 'mimes:png', 'max:8192',
                'dimensions:ratio=1/2,min_width=160,max_width=2000',
            ],
            'caption' => ['nullable', 'string', 'max:80'],
            'show_in_gallery' => ['nullable', 'boolean'],
        ], [
            'image.mimes' => 'La imagen debe ser PNG.',
            'image.dimensions' => 'La imagen debe tener proporción 2:4 (vertical, entre 160 y 2000 px de ancho).',
        ]);

        $path = $request->file('image')->store('character-images', 'public');
        $nextOrder = ((int) $character->images()->max('sort_order')) + 1;

        $img = $character->images()->create([
            'path' => $path,
            'caption' => $request->filled('caption') ? trim((string) $request->input('caption')) : null,
            'show_in_gallery' => $request->boolean('show_in_gallery', true),
            'sort_order' => $nextOrder,
        ]);

        return response()->json($img, 201);
    }

    /** Activa/desactiva si la imagen se muestra en la galería o edita su etiqueta. */
    public function updateImage(Request $request, Character $character, CharacterImage $image): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $this->ensureAlive($character);
        abort_unless($image->character_id === $character->id, 404);

        $data = $request->validate([
            'show_in_gallery' => ['sometimes', 'boolean'],
            'caption' => ['sometimes', 'nullable', 'string', 'max:80'],
        ]);

        if (array_key_exists('caption', $data) && $data['caption'] !== null) {
            $data['caption'] = trim($data['caption']) ?: null;
        }

        $image->update($data);

        return response()->json($image);
    }

    public function deleteImage(Request $request, Character $character, CharacterImage $image): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $this->ensureAlive($character);
        abort_unless($image->character_id === $character->id, 404);

        $image->delete();

        return response()->json(null, 204);
    }

    /** Solo Dungeon Master: suma o resta monedas al personaje (los NPCs ajenos siguen siendo privados). */
    public function adjustWallet(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwnerOrDm($request, $character);
        $this->ensureAlive($character);

        $deltas = $request->validate([
            'cp' => ['nullable', 'integer', 'min:-100000000', 'max:100000000'],
            'sp' => ['nullable', 'integer', 'min:-100000000', 'max:100000000'],
            'gp' => ['nullable', 'integer', 'min:-100000000', 'max:100000000'],
            'pp' => ['nullable', 'integer', 'min:-100000000', 'max:100000000'],
        ]);

        $sheet = $character->sheet;
        $sheet['money'] = Wallet::adjust($sheet['money'] ?? [], $deltas);
        $character->sheet = $sheet;
        $character->save();

        return response()->json($character->load(['user:id,name', 'images']));
    }

    /** Dueño del personaje vivo: convierte monedas entre sí sin alterar el valor total en oro. */
    public function convertWallet(Request $request, Character $character): JsonResponse
    {
        $this->authorizeOwner($request, $character);
        $this->ensureAlive($character);

        $sheet = $character->sheet;

        if ($request->boolean('compact')) {
            $sheet['money'] = Wallet::compact($sheet['money'] ?? []);
        } else {
            $data = $request->validate([
                'from' => ['required', 'string', 'in:cp,sp,gp,pp'],
                'to' => ['required', 'string', 'in:cp,sp,gp,pp', 'different:from'],
                'amount' => ['required', 'integer', 'min:1', 'max:100000000'],
            ]);
            $sheet['money'] = Wallet::convert($sheet['money'] ?? [], $data['from'], $data['to'], (int) $data['amount']);
        }

        $character->sheet = $sheet;
        $character->save();

        return response()->json($character->load(['user:id,name', 'images']));
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
            'gallery_visibility' => ['nullable', 'array'],
        ]);
    }

    private function ensureAlive(Character $character): void
    {
        abort_if(! $character->is_npc && $character->is_dead, 422, 'Este personaje ha muerto definitivamente y su hoja es de solo lectura.');
    }

    private function authorizeOwner(Request $request, Character $character): void
    {
        abort_unless($character->user_id === $request->user()->id, 403, 'Este personaje no es tuyo.');
    }

    private function authorizeOwnerOrDm(Request $request, Character $character): void
    {
        $user = $request->user();
        $allowed = $character->user_id === $user->id
            || (! $character->is_npc && $user->hasRole(Role::DungeonMaster));

        abort_unless($allowed, 403, 'Este personaje no es tuyo.');
    }
}
