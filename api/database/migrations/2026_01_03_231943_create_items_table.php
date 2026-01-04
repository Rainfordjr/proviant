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
            $table->string('sku')->nullable(); // Stock Keeping Unit
            $table->text('description')->nullable();
            
                       a@as-MacBook-Pro-5 web % cat ~/Projects/proviant/api/app/Models/Category.php
                       <?php

                       namespace App\Http\Controllers\Api;

                       use App\Http\Controllers\Controller;
                       use App\Models\Category;
                       use Illuminate\Http\JsonResponse;
                       use Illuminate\Http\Request;

                       class CategoryController extends Controller
                       {
                           /**
                            * Display a listing of categories.
                            */
                           public function index(Request $request): JsonResponse
                           {
                               $tenantId = $request->user()->tenant_id;

                               $categories = Category::forTenant($tenantId)
                                   ->with('parent:id,name')
                                   ->withCount('items')
                                   ->orderBy('name')
                                   ->get();

                               return response()->json($categories);
                           }

                           /**
                            * Store a newly created category.
                            */
                           public function store(Request $request): JsonResponse
                           {
                               $validated = $request->validate([
                                   'name' => ['required', 'string', 'max:255'],
                                   'description' => ['nullable', 'string', 'max:500'],
                                   'parent_id' => ['nullable', 'exists:categories,id'],
                                   'is_active' => ['boolean'],
                               ]);

                               // Verify parent belongs to same tenant if provided
                               if (!empty($validated['parent_id'])) {
                                   $parent = Category::find($validated['parent_id']);
                                   if ($parent->tenant_id !== $request->user()->tenant_id) {
                                       return response()->json(['message' => 'Invalid parent category'], 403);
                                   }
                               }

                               $category = Category::create([
                                   ...$validated,
                                   'tenant_id' => $request->user()->tenant_id,
                               ]);

                               return response()->json($category, 201);
                           }

                           /**
                            * Display the specified category.
                            */
                           public function show(Request $request, Category $category): JsonResponse
                           {
                               // Ensure category belongs to user's tenant
                               if ($category->tenant_id !== $request->user()->tenant_id) {
                                   return response()->json(['message' => 'Not found'], 404);
                               }

                               $category->load(['parent:id,name', 'children:id,parent_id,name', 'items']);

                               return response()->json($category);
                           }

                           /**
                            * Update the specified category.
                            */
                           public function update(Request $request, Category $category): JsonResponse
                           {
                               // Ensure category belongs to user's tenant
                               if ($category->tenant_id !== $request->user()->tenant_id) {
                                   return response()->json(['message' => 'Not found'], 404);
                               }

                               $validated = $request->validate([
                                   'name' => ['sometimes', 'required', 'string', 'max:255'],
                                   'description' => ['nullable', 'string', 'max:500'],
                                   'parent_id' => ['nullable', 'exists:categories,id'],
                                   'is_active' => ['boolean'],
                               ]);

                               // Prevent setting self as parent
                               if (!empty($validated['parent_id']) && $validated['parent_id'] == $category->id) {
                                   return response()->json(['message' => 'Category cannot be its own parent'], 422);
                               }

                               // Verify parent belongs to same tenant if provided
                               if (!empty($validated['parent_id'])) {
                                   $parent = Category::find($validated['parent_id']);
                                   if ($parent->tenant_id !== $request->user()->tenant_id) {
                                       return response()->json(['message' => 'Invalid parent category'], 403);
                                   }
                               }

                               $category->update($validated);

                               return response()->json($category);
                           }

                           /**
                            * Remove the specified category.
                            */
                           public function destroy(Request $request, Category $category): JsonResponse
                           {
                               // Ensure category belongs to user's tenant
                               if ($category->tenant_id !== $request->user()->tenant_id) {
                                   return response()->json(['message' => 'Not found'], 404);
                               }

                               // Check if category has items
                               if ($category->items()->count() > 0) {
                                   return response()->json([
                                       'message' => 'Cannot delete category with items. Move or delete items first.'
                                   ], 422);
                               }

                               $category->delete();

                               return response()->json(['message' => 'Category deleted']);
                           }
                       }%                                                                                                                a@as-MacBook-Pro-5 web % 
            // Item classification
            $table->enum('item_type', [
                'raw_material',
                'finished_product', 
                'packaging',
                'ingredient',
                'supply'
            ])->default('raw_material');
            
            // Units and quantities
            $table->string('unit_of_measure'); // kg, lbs, liters, pieces, etc.
            $table->decimal('current_stock', 12, 3)->default(0);
            $table->decimal('min_stock_level', 12, 3)->default(0);
            $table->decimal('max_stock_level', 12, 3)->nullable();
            
            // Pricing
            $table->decimal('cost_price', 10, 2)->nullable();
            $table->decimal('sale_price', 10, 2)->nullable();
            
            // Food-specific
            $table->integer('shelf_life_days')->nullable();
            $table->string('storage_requirements')->nullable(); // refrigerated, frozen, dry, etc.
            
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
