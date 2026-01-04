<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    /**
     * Display a listing of items with filtering and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $query = Item::forTenant($tenantId)
            ->with('category:id,name');

        // Search by name or SKU
        if ($request->filled('search')) {
            $query->search($request->search);
        }

        // Filter by category
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Filter by item type
        if ($request->filled('item_type')) {
            $query->ofType($request->item_type);
        }

        // Filter by active status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Filter low stock items
        if ($request->boolean('low_stock')) {
            $query->lowStock();
        }

        // Sorting
        $sortField = $request->input('sort', 'name');
        $sortDirection = $request->input('direction', 'asc');
        $allowedSorts = ['name', 'sku', 'current_stock', 'created_at', 'cost_price'];
        
        if (in_array($sortField, $allowedSorts)) {
            $query->orderBy($sortField, $sortDirection === 'desc' ? 'desc' : 'asc');
        }

        // Pagination
        $perPage = min($request->input('per_page', 25), 100);
        $items = $query->paginate($perPage);

        return response()->json($items);
    }

    /**
     * Store a newly created item.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'item_type' => ['required', 'in:raw_material,finished_product,packaging,ingredient,supply'],
            'unit_of_measure' => ['required', 'string', 'max:50'],
            'current_stock' => ['numeric', 'min:0'],
            'min_stock_level' => ['numeric', 'min:0'],
            'max_stock_level' => ['nullable', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'shelf_life_days' => ['nullable', 'integer', 'min:0'],
            'storage_requirements' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $tenantId = $request->user()->tenant_id;

        // Verify category belongs to same tenant if provided
        if (!empty($validated['category_id'])) {
            $category = \App\Models\Category::find($validated['category_id']);
            if ($category->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Invalid category'], 403);
            }
        }

        // Check for duplicate SKU within tenant
        if (!empty($validated['sku'])) {
            $existingSku = Item::forTenant($tenantId)
                ->where('sku', $validated['sku'])
                ->exists();
            
            if ($existingSku) {
                return response()->json([
                    'message' => 'The SKU has already been taken.',
                    'errors' => ['sku' => ['The SKU has already been taken.']]
                ], 422);
            }
        }

        $item = Item::create([
            ...$validated,
            'tenant_id' => $tenantId,
        ]);

        $item->load('category:id,name');

        return response()->json($item, 201);
    }

    /**
     * Display the specified item.
     */
    public function show(Request $request, Item $item): JsonResponse
    {
        // Ensure item belongs to user's tenant
        if ($item->tenant_id !== $request->user()->tenant_id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $item->load('category:id,name');

        return response()->json($item);
    }

    /**
     * Update the specified item.
     */
    public function update(Request $request, Item $item): JsonResponse
    {
        // Ensure item belongs to user's tenant
        if ($item->tenant_id !== $request->user()->tenant_id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'item_type' => ['sometimes', 'required', 'in:raw_material,finished_product,packaging,ingredient,supply'],
            'unit_of_measure' => ['sometimes', 'required', 'string', 'max:50'],
            'current_stock' => ['numeric', 'min:0'],
            'min_stock_level' => ['numeric', 'min:0'],
            'max_stock_level' => ['nullable', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'shelf_life_days' => ['nullable', 'integer', 'min:0'],
            'storage_requirements' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $tenantId = $request->user()->tenant_id;

        // Verify category belongs to same tenant if provided
        if (!empty($validated['category_id'])) {
            $category = \App\Models\Category::find($validated['category_id']);
            if ($category->tenant_id !== $tenantId) {
                return response()->json(['message' => 'Invalid category'], 403);
            }
        }

        // Check for duplicate SKU within tenant (excluding current item)
        if (!empty($validated['sku'])) {
            $existingSku = Item::forTenant($tenantId)
                ->where('sku', $validated['sku'])
                ->where('id', '!=', $item->id)
                ->exists();
            
            if ($existingSku) {
                return response()->json([
                    'message' => 'The SKU has already been taken.',
                    'errors' => ['sku' => ['The SKU has already been taken.']]
                ], 422);
            }
        }

        $item->update($validated);
        $item->load('category:id,name');

        return response()->json($item);
    }

    /**
     * Remove the specified item.
     */
    public function destroy(Request $request, Item $item): JsonResponse
    {
        // Ensure item belongs to user's tenant
        if ($item->tenant_id !== $request->user()->tenant_id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $item->delete();

        return response()->json(['message' => 'Item deleted']);
    }

    /**
     * Adjust stock level (add or subtract).
     */
    public function adjustStock(Request $request, Item $item): JsonResponse
    {
        // Ensure item belongs to user's tenant
        if ($item->tenant_id !== $request->user()->tenant_id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'adjustment' => ['required', 'numeric'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $newStock = $item->current_stock + $validated['adjustment'];

        if ($newStock < 0) {
            return response()->json([
                'message' => 'Insufficient stock. Current stock: ' . $item->current_stock
            ], 422);
        }

        $item->update(['current_stock' => $newStock]);

        // TODO: Log stock adjustment with reason for audit trail

        return response()->json([
            'message' => 'Stock adjusted',
            'previous_stock' => $item->current_stock - $validated['adjustment'],
            'adjustment' => $validated['adjustment'],
            'new_stock' => $item->current_stock,
        ]);
    }

    /**
     * Get item type options.
     */
    public function types(): JsonResponse
    {
        return response()->json(Item::ITEM_TYPES);
    }

    /**
     * Get unit of measure options.
     */
    public function units(): JsonResponse
    {
        return response()->json(Item::UNITS_OF_MEASURE);
    }

    /**
     * Get low stock items for the current tenant.
     */
    public function lowStock(Request $request): JsonResponse
    {
        $items = Item::forTenant($request->user()->tenant_id)
            ->active()
            ->lowStock()
            ->with('category:id,name')
            ->orderBy('current_stock')
            ->get();

        return response()->json($items);
    }

    /**
     * Get inventory summary stats.
     */
    public function summary(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $stats = [
            'total_items' => Item::forTenant($tenantId)->count(),
            'active_items' => Item::forTenant($tenantId)->active()->count(),
            'low_stock_count' => Item::forTenant($tenantId)->active()->lowStock()->count(),
            'out_of_stock_count' => Item::forTenant($tenantId)->active()->where('current_stock', '<=', 0)->count(),
            'total_value' => Item::forTenant($tenantId)
                ->active()
                ->selectRaw('SUM(current_stock * COALESCE(cost_price, 0)) as total')
                ->value('total') ?? 0,
            'by_type' => Item::forTenant($tenantId)
                ->active()
                ->selectRaw('item_type, COUNT(*) as count')
                ->groupBy('item_type')
                ->pluck('count', 'item_type'),
        ];

        return response()->json($stats);
    }
}