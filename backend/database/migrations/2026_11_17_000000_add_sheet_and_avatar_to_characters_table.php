<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('backstory');
            // Resto de la hoja de personaje (habilidades, conjuros, equipo, rasgos…)
            $table->json('sheet')->nullable()->after('avatar_path');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn(['avatar_path', 'sheet']);
        });
    }
};
