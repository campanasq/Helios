<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** Registro: todo usuario nuevo entra con rol "en_fila". */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $user = User::create($data);
        $user->refresh();

        return response()->json([
            'token' => $user->createToken('auth')->plainTextToken,
            'user' => $user,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Credenciales incorrectas.']);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages(['email' => 'Tu cuenta ha sido dada de baja.']);
        }

        return response()->json([
            'token' => $user->createToken('auth')->plainTextToken,
            'user' => $user,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Sesión cerrada.']);
    }
}
