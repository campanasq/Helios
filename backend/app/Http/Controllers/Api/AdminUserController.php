<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Gestión de usuarios.
 *  - Admins: listar, aceptar usuarios en fila y cambiar roles.
 *  - Superadmin: además asignar/quitar admins y dar de baja/reactivar.
 */
class AdminUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query()->orderByDesc('created_at');

        if ($role = $request->query('role')) {
            $query->where('role', $role);
        }
        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        return response()->json($query->get());
    }

    /** Cambia el rol de juego (incluye aceptar a alguien "en fila"). */
    public function updateRole(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(Role::assignable())],
        ]);

        $this->guardTarget($request, $user, allowSelf: false);

        $user->role = Role::from($data['role']);
        $user->save();

        return response()->json($user);
    }

    /** Solo superadmin: asignar o quitar permisos de admin. */
    public function setAdmin(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['is_admin' => ['required', 'boolean']]);

        $this->guardTarget($request, $user, allowSelf: false);

        $user->is_admin = $data['is_admin'];
        $user->save();

        return response()->json($user);
    }

    /** Solo superadmin: dar de baja (is_active=false) o reactivar. */
    public function setActive(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);

        $this->guardTarget($request, $user, allowSelf: false);

        $user->is_active = $data['is_active'];
        $user->save();

        if (! $user->is_active) {
            $user->tokens()->delete(); // cierra todas sus sesiones
        }

        return response()->json($user);
    }

    /** Nadie puede modificar al superadmin ni a sí mismo desde estas rutas. */
    private function guardTarget(Request $request, User $target, bool $allowSelf): void
    {
        abort_if($target->is_superadmin, 403, 'No se puede modificar al superadmin.');
        abort_if(! $allowSelf && $target->id === $request->user()->id, 403, 'No puedes modificar tu propia cuenta.');
        // Un admin normal no puede tocar a otros admins; solo el superadmin.
        abort_if($target->is_admin && ! $request->user()->is_superadmin, 403, 'Solo el superadmin puede modificar a otros admins.');
    }
}
