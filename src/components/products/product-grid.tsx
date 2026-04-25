"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Factory,
  Truck,
  Filter,
  ChevronDown,
  ChevronRight,
  X,
  Search,
  Package,
  Box,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";

/* ── sessionStorage helpers for expand state persistence ── */
const STORAGE_KEY = "proviant:products:expandedIds";

function saveExpandState(ids: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // sessionStorage unavailable, ignore
  }
}

function loadExpandState(): Set<string> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return null;
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  is_active: boolean;
  product_type: string;
  category_id: string | null;
  product_categories: { name: string } | null;
  category: string | null;
  recipe_id?: string | null;
}

interface Component {
  product_id: string;
  component_type: string;
  component_product_id: string | null;
  recipe_id: string | null;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: string;
  name: string;
}

interface ProductGridProps {
  products: Product[];
  categories: Category[];
  batchCountMap: Record<string, number>;
  components: Component[];
  recipes: Recipe[];
}

/* ── Tree node type ── */
interface TreeNode {
  product: Product;
  children: TreeNode[];
  depth: number;
  quantity?: number;
  unit?: string;
}

/* ── Searchable category combobox ── */
function CategoryCombobox({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );
  const options: { id: string; label: string }[] = [
    ...(query.length === 0 ? [{ id: "all", label: "All Categories" }] : []),
    ...filtered.map((c) => ({ id: c.id, label: c.name })),
  ];

  useEffect(() => {
    setHighlightIdx(0);
  }, [query, open]);

  const selectedName =
    value === "all" ? "" : categories.find((c) => c.id === value)?.name || "";

  const handleSelect = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (options[highlightIdx]) handleSelect(options[highlightIdx].id);
        break;
      case "Escape":
        setOpen(false);
        setQuery("");
        break;
    }
  };

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex items-center rounded-lg border bg-white text-sm ${
          open ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-300"
        }`}
      >
        <Search size={14} className="ml-2.5 shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder={value === "all" ? "All Categories" : selectedName}
          value={open ? query : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-36 bg-transparent px-2 py-1.5 text-sm text-gray-700 placeholder-gray-500 focus:outline-none"
        />
        {value !== "all" ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange("all");
              setQuery("");
              setOpen(false);
            }}
            className="mr-1 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className="mr-2.5 shrink-0 text-gray-400 cursor-pointer"
            onClick={() => {
              setOpen(!open);
              if (!open) inputRef.current?.focus();
            }}
          />
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((opt, idx) => (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                idx === highlightIdx ? "bg-gray-100" : ""
              } ${
                value === opt.id ? "text-blue-700 font-medium" : "text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No categories found</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Depth indicator lines ── */
function DepthGuide({ depth }: { depth: number }) {
  if (depth === 0) return null;
  return (
    <div className="flex items-center shrink-0">
      {Array.from({ length: depth }).map((_, i) => (
        <div key={i} className="w-6 flex justify-center">
          <div className="w-px h-full bg-gray-200" />
        </div>
      ))}
      <div className="w-4 h-px bg-gray-300 mr-1" />
    </div>
  );
}

/* ── Single product row in the tree ── */
function ProductRow({
  node,
  batchCount,
  hasChildren,
  expanded,
  onToggle,
  onToggleAll,
  allExpanded,
}: {
  node: TreeNode;
  batchCount: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Toggle all descendants — only shown on depth-0 rows with children */
  onToggleAll?: () => void;
  allExpanded?: boolean;
}) {
  const { product, depth, quantity, unit } = node;
  const isProduction = product.product_type === "production";
  const categoryName = product.product_categories?.name || product.category;
  const isBase = depth === 0;
  const showGroupToggle = isBase && hasChildren && onToggleAll;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border bg-white px-4 py-3 hover:border-blue-200 hover:shadow-sm transition-all ${
        isBase ? "border-gray-200 shadow-sm" : "border-gray-100"
      }`}
    >
      <DepthGuide depth={depth} />

      {/* Expand toggle for products with children */}
      {hasChildren ? (
        <button
          onClick={onToggle}
          className="shrink-0 rounded p-0.5 hover:bg-gray-100"
        >
          {expanded ? (
            <ChevronDown size={14} className="text-gray-500" />
          ) : (
            <ChevronRight size={14} className="text-gray-500" />
          )}
        </button>
      ) : (
        <div className="w-5 shrink-0" />
      )}

      {/* Icon */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isBase
            ? "bg-blue-50 text-blue-600"
            : depth === 1
            ? "bg-purple-50 text-purple-500"
            : "bg-gray-50 text-gray-400"
        }`}
      >
        {isBase ? <Package size={14} /> : <Box size={14} />}
      </div>

      {/* Product info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/products/${product.id}`}
            className="font-medium text-gray-900 hover:text-blue-600 truncate"
          >
            {product.name}
          </Link>
          {!product.is_active && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 shrink-0">
              Inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
          <span>{product.sku}</span>
          {quantity && (
            <span className="text-gray-400">
              contains {quantity} {unit}
            </span>
          )}
        </div>
      </div>

      {/* Badges + per-product expand/collapse */}
      <div className="flex items-center gap-2 shrink-0">
        {showGroupToggle && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleAll!(); }}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
            title={allExpanded ? "Collapse this product family" : "Expand this product family"}
          >
            {allExpanded ? <ChevronsDownUp size={12} /> : <ChevronsUpDown size={12} />}
            {allExpanded ? "Collapse" : "Expand"}
          </button>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            isProduction
              ? "bg-blue-50 text-blue-700"
              : "bg-purple-50 text-purple-700"
          }`}
        >
          {isProduction ? <Factory size={10} /> : <Truck size={10} />}
          {isProduction ? "Prod" : "Dist"}
        </span>
        {categoryName && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 capitalize">
            {categoryName}
          </span>
        )}
        <span className="text-xs text-gray-400 w-16 text-right">
          {product.unit}
        </span>
        <span className="text-xs text-gray-400 w-20 text-right">
          {batchCount > 0 ? `${batchCount} batch${batchCount !== 1 ? "es" : ""}` : ""}
        </span>
      </div>
    </div>
  );
}

/* ── Build tree from flat products + components ── */
function buildTree(
  products: Product[],
  components: Component[],
  productMap: Map<string, Product>
): { roots: TreeNode[]; standalone: Product[] } {
  // Build: parentProductId → child products that wrap/package it
  // product_components: product_id CONTAINS component_product_id
  // Tree direction: base product at top → products that contain it as children
  const childrenOf = new Map<string, { productId: string; quantity: number; unit: string }[]>();
  for (const c of components) {
    if (c.component_type === "product" && c.component_product_id) {
      const existing = childrenOf.get(c.component_product_id) || [];
      existing.push({ productId: c.product_id, quantity: c.quantity, unit: c.unit });
      childrenOf.set(c.component_product_id, existing);
    }
  }

  function buildNode(productId: string, depth: number, quantity?: number, unit?: string): TreeNode | null {
    const product = productMap.get(productId);
    if (!product) return null;

    const childEntries = childrenOf.get(productId) || [];
    const children: TreeNode[] = [];
    for (const entry of childEntries) {
      const child = buildNode(entry.productId, depth + 1, entry.quantity, entry.unit);
      if (child) children.push(child);
    }
    children.sort((a, b) => a.product.name.localeCompare(b.product.name));

    return { product, children, depth, quantity, unit };
  }

  // Products with recipe_id are roots
  const roots: TreeNode[] = [];
  const accountedFor = new Set<string>();

  for (const p of products) {
    if (p.recipe_id) {
      const tree = buildNode(p.id, 0);
      if (tree) {
        roots.push(tree);
        const markAll = (node: TreeNode) => {
          accountedFor.add(node.product.id);
          node.children.forEach(markAll);
        };
        markAll(tree);
      }
    }
  }

  roots.sort((a, b) => a.product.name.localeCompare(b.product.name));

  const standalone = products.filter((p) => !accountedFor.has(p.id));

  return { roots, standalone };
}

/* ── Collect all expandable IDs (nodes with children) ── */
function collectExpandableIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) {
    if (n.children.length > 0) {
      ids.push(n.product.id);
      ids.push(...collectExpandableIds(n.children));
    }
  }
  return ids;
}

/* ── Recursive tree renderer ── */
function TreeRows({
  nodes,
  batchCountMap,
  expandedIds,
  setExpandedIds,
  toggleExpanded,
}: {
  nodes: TreeNode[];
  batchCountMap: Record<string, number>;
  expandedIds: Set<string>;
  setExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpanded: (id: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedIds.has(node.product.id);
        const isRoot = node.depth === 0;

        // For root nodes: compute whether all descendants are expanded
        let allExpanded = false;
        let onToggleAll: (() => void) | undefined;

        if (isRoot && hasChildren) {
          const expandableInTree = collectExpandableIds([node]);
          allExpanded =
            expandableInTree.length > 0 &&
            expandableInTree.every((id) => expandedIds.has(id));

          onToggleAll = () => {
            setExpandedIds((prev) => {
              const next = new Set(prev);
              if (allExpanded) {
                // Collapse: remove all expandable IDs in this subtree
                expandableInTree.forEach((id) => next.delete(id));
              } else {
                // Expand: add all expandable IDs in this subtree
                expandableInTree.forEach((id) => next.add(id));
              }
              return next;
            });
          };
        }

        return (
          <div key={node.product.id}>
            <ProductRow
              node={node}
              batchCount={batchCountMap[node.product.id] || 0}
              hasChildren={hasChildren}
              expanded={isExpanded}
              onToggle={() => toggleExpanded(node.product.id)}
              onToggleAll={onToggleAll}
              allExpanded={allExpanded}
            />
            {hasChildren && isExpanded && (
              <div className="ml-2">
                <TreeRows
                  nodes={node.children}
                  batchCountMap={batchCountMap}
                  expandedIds={expandedIds}
                  setExpandedIds={setExpandedIds}
                  toggleExpanded={toggleExpanded}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Main grid ── */
export default function ProductGrid({
  products,
  categories,
  batchCountMap,
  components,
  recipes,
}: ProductGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    return loadExpandState() || new Set<string>();
  });

  // Persist to sessionStorage whenever expand state changes
  useEffect(() => {
    saveExpandState(expandedIds);
  }, [expandedIds]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Apply filters
  const filtered = products.filter((p) => {
    if (selectedCategory !== "all" && p.category_id !== selectedCategory) return false;
    if (selectedType !== "all" && p.product_type !== selectedType) return false;
    return true;
  });

  const hasActiveFilters = selectedCategory !== "all" || selectedType !== "all";

  // Build the product map from filtered products
  const productMap = new Map<string, Product>();
  filtered.forEach((p) => productMap.set(p.id, p));

  // Build tree
  const { roots, standalone } = buildTree(filtered, components, productMap);

  const expandAll = () => {
    const allIds = new Set<string>();
    const addAll = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) allIds.add(n.product.id);
        addAll(n.children);
      }
    };
    addAll(roots);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Filter size={14} />
          <span>Filter:</span>
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="production">Production</option>
          <option value="distribution">Distribution</option>
        </select>

        <CategoryCombobox
          categories={categories}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSelectedCategory("all");
              setSelectedType("all");
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-400 mr-1">
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={expandAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronsUpDown size={14} />
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronsDownUp size={14} />
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree view */}
      <div className="space-y-1.5">
        <TreeRows
          nodes={roots}
          batchCountMap={batchCountMap}
          expandedIds={expandedIds}
          setExpandedIds={setExpandedIds}
          toggleExpanded={toggleExpanded}
        />

        {/* Standalone products (no recipe, not in any tree) */}
        {standalone.length > 0 && (
          <>
            {roots.length > 0 && (
              <div className="border-t border-gray-200 my-3" />
            )}
            {standalone.map((p) => (
              <ProductRow
                key={p.id}
                node={{ product: p, children: [], depth: 0 }}
                batchCount={batchCountMap[p.id] || 0}
                hasChildren={false}
                expanded={false}
                onToggle={() => {}}
              />
            ))}
          </>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No products match the selected filters.</p>
          <button
            onClick={() => {
              setSelectedCategory("all");
              setSelectedType("all");
            }}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
