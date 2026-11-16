<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('missions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('title', 150);
            $table->text('description');
            $table->string('difficulty', 20)->default('media');   // facil | media | dificil | mortal
            $table->string('status', 20)->default('abierta');     // abierta | en_curso | completada
            $table->unsignedTinyInteger('min_level')->default(1);
            $table->string('reward', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('missions');
    }
};
