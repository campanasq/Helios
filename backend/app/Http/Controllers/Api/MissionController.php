<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MissionController extends Controller
{
    /** Jugadores y DMs pueden ver las misiones. */
    public function index(): JsonResponse
    {
        return response()->json(Mission::with('creator:id,name')->latest()->get());
    }

    public function show(Mission $mission): JsonResponse
    {
        return response()->json($mission->load('creator:id,name'));
    }

    /** Solo DM (protegido en rutas). */
    public function store(Request $request): JsonResponse
    {
        $mission = new Mission($this->validated($request));
        $mission->created_by = $request->user()->id;
        $mission->save();

        return response()->json($mission->load('creator:id,name'), 201);
    }

    public function update(Request $request, Mission $mission): JsonResponse
    {
        $mission->update($this->validated($request));
        return response()->json($mission->load('creator:id,name'));
    }

    public function destroy(Mission $mission): JsonResponse
    {
        $mission->delete();
        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['required', 'string', 'max:10000'],
            'difficulty' => ['required', Rule::in(Mission::DIFFICULTIES)],
            'status' => ['required', Rule::in(Mission::STATUSES)],
            'min_level' => ['required', 'integer', 'min:1', 'max:20'],
            'reward' => ['nullable', 'string', 'max:255'],
        ]);
    }
}
