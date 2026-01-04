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
}