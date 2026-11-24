<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::firstOrNew(['email' => config('app.superadmin.email')]);
        $user->name = config('app.superadmin.name');
        if (! $user->exists) {
            $password = config('app.superadmin.password');
            if (! $password) {
                throw new \RuntimeException('Define SUPERADMIN_PASSWORD en el .env antes de ejecutar el seeder.');
            }
            $user->password = $password;
        }
        $user->role = Role::DungeonMaster;
        $user->is_admin = true;
        $user->is_superadmin = true;
        $user->is_active = true;
        $user->save();

        $this->call(ShopSeeder::class);
    }
}
