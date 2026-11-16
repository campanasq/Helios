<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('race', 50);
            $table->string('class', 50);
            $table->unsignedTinyInteger('level')->default(1);
            $table->string('alignment', 50)->nullable();
            $table->string('background', 100)->nullable();
            $table->unsignedTinyInteger('strength')->default(10);
            $table->unsignedTinyInteger('dexterity')->default(10);
            $table->unsignedTinyInteger('constitution')->default(10);
            $table->unsignedTinyInteger('intelligence')->default(10);
            $table->unsignedTinyInteger('wisdom')->default(10);
            $table->unsignedTinyInteger('charisma')->default(10);
            $table->unsignedSmallInteger('hit_points')->default(10);
            $table->unsignedTinyInteger('armor_class')->default(10);
            $table->text('backstory')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('characters');
    }
};
