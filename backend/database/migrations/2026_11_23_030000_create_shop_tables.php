<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchants', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('title', 120)->nullable();
            $table->string('rotation_label', 80)->nullable();
            $table->string('voice_pitch', 20)->default('low');
            $table->boolean('is_active')->default(false);
            $table->text('greeting');
            $table->text('purchase_line');
            $table->text('no_gold_line');
            $table->json('poses')->nullable();
            $table->json('dialogues')->nullable();
            $table->timestamps();
        });

        Schema::create('shop_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('name', 120);
            $table->text('description');
            $table->unsignedInteger('price_gp');
            $table->string('image_path')->nullable();
            $table->string('inspect_pose', 20)->default('explaining');
            $table->timestamp('sold_at')->nullable();
            $table->foreignId('sold_to_character_id')->nullable()->constrained('characters')->nullOnDelete();
            $table->foreignId('sold_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('shop_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->foreignId('character_id')->nullable()->constrained('characters')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('merchant_name', 100);
            $table->string('character_name', 100);
            $table->string('item_name', 120);
            $table->text('item_description')->nullable();
            $table->unsignedInteger('price_gp');
            $table->timestamp('purchased_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_purchases');
        Schema::dropIfExists('shop_items');
        Schema::dropIfExists('merchants');
    }
};
