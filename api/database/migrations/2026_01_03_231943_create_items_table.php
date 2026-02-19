<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->foreignId('category_id')->nullable()->constrained()->onDelete('set null');
            
            // Basic info
            $table->string('name');
            $table->string('sku')->nullable();
            $table->text('description')->nullable();
            
            // Item classification
            $table->enum('item_type', [
                'raw_material',
                'finished_product', 
                'packaging',
                'ingredient',
                'supply'
            ])->default('raw_material');
            
            // Units and quantities
            $table->string('unit_of_measure');
            $table->decimal('current_stock', 12, 3)->default(0);
            $table->decimal('min_stock_level', 12, 3)->default(0);
            $table->decimal('max_stock_level', 12, 3)->nullable();
            
            // Pricing
            $table->decimal('cost_price', 10, 2)->nullable();
            $table->decimal('sale_price', 10, 2)->nullable();
            
            // Food-specific
            $table->integer('shelf_life_days')->nullable();
            $table->string('storage_requirements')->nullable();
            
            // Status
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Indexes
            $table->index(['tenant_id', 'is_active']);
            $table->index(['tenant_id', 'item_type']);
            $table->index(['tenant_id', 'sku']);
            
            // SKU should be unique per tenant
            $table->unique(['tenant_id', 'sku']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};