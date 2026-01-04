<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Item extends Model
{
    protected $fillable = [
        'tenant_id',
        'category_id',
        'name',
        'sku',
        'description',
        'item_type',
        'unit_of_measure',
        'current_stock',
        'min_stock_level',
        'max_stock_level',
        'cost_price',
        'sale_price',
        'shelf_life_days',
        'storage_requirements',
        'is_active',
    ];

    protected $casts = [
        'current_stock' => 'decimal:3',
        'min_stock_level' => 'decimal:3',
        'max_stock_level' => 'decimal:3',
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'shelf_life_days' => 'integer',
        'is_active' => 'boolean',
    ];

    public const ITEM_TYPES = [
        'raw_material' => 'Raw Material',
        'finished_product' => 'Finished Product',
        'packaging' => 'Packaging',
        'ingredient' => 'Ingredient',
        'supply' => 'Supply',
    ];

    public const UNITS_OF_MEASURE = [
        'kg' => 'Kilograms',
        'g' => 'Grams',
        'lb' => 'Pounds',
        'oz' => 'Ounces',
        'l' => 'Liters',
        'ml' => 'Milliliters',
        'gal' => 'Gallons',
        'pcs' => 'Pieces',
        'box' => 'Boxes',
        'case' => 'Cases',
        'bag' => 'Bags',
        'roll' => 'Rolls',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function scopeForTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeOfType($query, $type)
    {
        return $query->where('item_type', $type);
    }

    public function scopeLowStock($query)
    {
        return $query->whereColumn('current_stock', '<=', 'min_stock_level');
    }

    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
              ->orWhere('sku', 'like', "%{$search}%");
        });
    }
}