"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Barcode,
  Pencil,
  Check,
  X,
  Wand2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronsDownUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Product {
  id: string;
  name: string;
  sku: string;
  upc: string | null;
  gtin: string | null;
  is_active: boolean;
  recipe_id: string | null;
}

interface Component {
  product_id: string;
  component_type: string;
  component_product_id: string | null;
  quantity: number;
  unit: string;
}

interface TreeNode {
  product: Product;
  children: TreeNode[];
  depth: number;
}

interface Props {
  org: { id: string; upc_prefix: string | null; gtin_prefix: string | null } | null;
  products: Product[];
  components: Component[];
}

/* ── UPC-A check digit (mod 10) ── */
function upcCheckDigit(first11: string): string {
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const d = parseInt(first11[i], 10);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return String((10 - (sum % 10)) % 10);
}

/* ── GTIN-14 check digit (mod 10) ── */
function gtinCheckDigit(first13: string): string {
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = parseInt(first13[i], 10);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return String((10 - (sum % 10)) % 10);
}

/* ── Build tree (same logic as product-grid) ── */
function buildTree(
  products: Product[],
  components: Component[]
): { roots: TreeNode[]; standalone: Product[] } {
  const productMap = new Map<string, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  // base product → products that wrap/package it
  const childrenOf = new Map<string, { productId: string }[]>();
  for (const c of components) {
    if (c.component_type === "product" && c.component_product_id) {
      const existing = childrenOf.get(c.component_product_id) || [];
      existing.push({ productId: c.product_id });
      childrenOf.set(c.component_product_id, existing);
    }
  }

  function buildNode(productId: string, depth: number): TreeNode | null {
    const product = productMap.get(productId);
    if (!product) return null;

    const childEntries = childrenOf.get(productId) || [];
    const children: TreeNode[] = [];
    for (const entry of childEntries) {
      const child = buildNode(entry.productId, depth + 1);
      if (child) children.push(child);
    }
    children.sort((a, b) => a.product.name.localeCompare(b.product.name));

    return { product, children, depth };
  }

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

/* ── Flatten tree into ordered list for filtering ── */
function flattenTree(nodes: TreeNode[]): Product[] {
  const result: Product[] = [];
  const walk = (n: TreeNode) => {
    result.push(n.product);
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return result;
}

/* ── Collect all expandable IDs ── */
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

export function IdentifiersRegistry({ org, products, components }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "upc" | "gtin" | "missing" | "duplicates">("all");

  // Expand/collapse
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set<string>());

  // Prefix editing
  const [editingUpcPrefix, setEditingUpcPrefix] = useState(false);
  const [editingGtinPrefix, setEditingGtinPrefix] = useState(false);
  const [upcPrefixDraft, setUpcPrefixDraft] = useState(org?.upc_prefix || "");
  const [gtinPrefixDraft, setGtinPrefixDraft] = useState(org?.gtin_prefix || "");
  const [savingPrefix, setSavingPrefix] = useState(false);

  // Find duplicates
  const { upcDuplicates, gtinDuplicates } = useMemo(() => {
    const upcMap = new Map<string, string[]>();
    const gtinMap = new Map<string, string[]>();

    for (const p of products) {
      if (p.upc) {
        const ids = upcMap.get(p.upc) || [];
        ids.push(p.id);
        upcMap.set(p.upc, ids);
      }
      if (p.gtin) {
        const ids = gtinMap.get(p.gtin) || [];
        ids.push(p.id);
        gtinMap.set(p.gtin, ids);
      }
    }

    const upcDups = new Set<string>();
    const gtinDups = new Set<string>();
    for (const [, ids] of upcMap) if (ids.length > 1) upcDups.add(ids[0]);
    for (const [, ids] of gtinMap) if (ids.length > 1) gtinDups.add(ids[0]);

    // Store the actual code values for matching
    const upcDupCodes = new Set<string>();
    const gtinDupCodes = new Set<string>();
    for (const [code, ids] of upcMap) if (ids.length > 1) upcDupCodes.add(code);
    for (const [code, ids] of gtinMap) if (ids.length > 1) gtinDupCodes.add(code);

    return { upcDuplicates: upcDupCodes, gtinDuplicates: gtinDupCodes };
  }, [products]);

  const totalDuplicates = upcDuplicates.size + gtinDuplicates.size;

  // Build tree
  const { roots, standalone } = useMemo(
    () => buildTree(products, components),
    [products, components]
  );

  // For filter counts, use all products
  const withUpc = products.filter((p) => p.upc).length;
  const withGtin = products.filter((p) => p.gtin).length;
  const missing = products.filter((p) => !p.upc && !p.gtin).length;

  // Filter function for individual products
  const matchesFilter = (p: Product): boolean => {
    if (filter === "upc") return !!p.upc;
    if (filter === "gtin") return !!p.gtin;
    if (filter === "missing") return !p.upc && !p.gtin;
    if (filter === "duplicates")
      return (
        (!!p.upc && upcDuplicates.has(p.upc)) ||
        (!!p.gtin && gtinDuplicates.has(p.gtin))
      );
    return true;
  };

  const matchesSearch = (p: Product): boolean => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (!!p.upc && p.upc.includes(q)) ||
      (!!p.gtin && p.gtin.includes(q))
    );
  };

  // Check if a tree node or any descendant matches
  const treeHasMatch = (node: TreeNode): boolean => {
    if (matchesFilter(node.product) && matchesSearch(node.product)) return true;
    return node.children.some(treeHasMatch);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  // Prefix save
  const savePrefix = async (field: "upc_prefix" | "gtin_prefix", value: string) => {
    if (!org) return;
    setSavingPrefix(true);
    const supabase = createClient();
    await supabase
      .from("organizations")
      .update({ [field]: value || null })
      .eq("id", org.id);
    setSavingPrefix(false);
    if (field === "upc_prefix") setEditingUpcPrefix(false);
    else setEditingGtinPrefix(false);
    router.refresh();
  };

  // Auto-generate UPC
  const generateUpc = async (productId: string) => {
    const prefix = org?.upc_prefix;
    if (!prefix) return;
    const existingNums = products
      .filter((p) => p.upc && p.upc.startsWith(prefix))
      .map((p) => parseInt(p.upc!.slice(prefix.length, 11), 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    const itemPart = String(nextNum).padStart(11 - prefix.length, "0");
    const first11 = prefix + itemPart;
    const full = first11 + upcCheckDigit(first11);
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ upc: full, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (!error) router.refresh();
  };

  // Auto-generate GTIN
  const generateGtin = async (productId: string) => {
    const prefix = org?.gtin_prefix;
    if (!prefix) return;
    const existingNums = products
      .filter((p) => p.gtin && p.gtin.startsWith(prefix))
      .map((p) => parseInt(p.gtin!.slice(prefix.length, 13), 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    const itemPart = String(nextNum).padStart(13 - prefix.length, "0");
    const first13 = prefix + itemPart;
    const full = first13 + gtinCheckDigit(first13);
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ gtin: full, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (!error) router.refresh();
  };

  // Render a single product row
  function ProductRow({ product, depth }: { product: Product; depth: number }) {
    const upcIsDup = product.upc ? upcDuplicates.has(product.upc) : false;
    const gtinIsDup = product.gtin ? gtinDuplicates.has(product.gtin) : false;

    return (
      <tr className="hover:bg-gray-50 group">
        <td className="px-4 py-3 text-sm">
          <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
            {depth > 0 && (
              <span className="text-gray-300 mr-2">└</span>
            )}
            <Link
              href={`/products/${product.id}`}
              className="font-medium text-blue-600 hover:text-blue-800"
            >
              {product.name}
            </Link>
            {!product.is_active && (
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                Inactive
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 font-mono">{product.sku}</td>
        <td className="px-4 py-3 text-sm">
          {product.upc ? (
            <span
              className={`inline-flex items-center gap-1.5 font-mono ${
                upcIsDup ? "text-red-700 font-semibold" : "text-gray-900"
              }`}
            >
              {upcIsDup && <AlertTriangle size={12} className="text-red-500" />}
              {product.upc}
            </span>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm">
          {product.gtin ? (
            <span
              className={`inline-flex items-center gap-1.5 font-mono ${
                gtinIsDup ? "text-red-700 font-semibold" : "text-gray-900"
              }`}
            >
              {gtinIsDup && <AlertTriangle size={12} className="text-red-500" />}
              {product.gtin}
            </span>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm">
          {product.upc || product.gtin ? (
            <span className="inline-flex items-center gap-1 text-green-600 text-xs">
              <CheckCircle size={12} /> Assigned
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
              <AlertTriangle size={12} /> Missing
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!product.upc && org?.upc_prefix && (
              <button
                onClick={() => generateUpc(product.id)}
                className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                title="Auto-generate UPC"
              >
                <span className="inline-flex items-center gap-1">
                  <Wand2 size={11} /> UPC
                </span>
              </button>
            )}
            {!product.gtin && org?.gtin_prefix && (
              <button
                onClick={() => generateGtin(product.id)}
                className="rounded px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                title="Auto-generate GTIN"
              >
                <span className="inline-flex items-center gap-1">
                  <Wand2 size={11} /> GTIN
                </span>
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // Render tree rows recursively
  function TreeRows({ nodes }: { nodes: TreeNode[] }) {
    return (
      <>
        {nodes.map((node) => {
          if (!treeHasMatch(node)) return null;

          const hasChildren = node.children.length > 0;
          const isExpanded = expandedIds.has(node.product.id);
          const nodeMatches =
            matchesFilter(node.product) && matchesSearch(node.product);

          return (
            <Fragment key={node.product.id}>
              {/* Show the row if it matches, or if a descendant matches (as context) */}
              <tr
                className={`hover:bg-gray-50 group ${
                  !nodeMatches ? "opacity-40" : ""
                }`}
              >
                <td className="px-4 py-3 text-sm">
                  <div
                    className="flex items-center"
                    style={{ paddingLeft: `${node.depth * 24}px` }}
                  >
                    {node.depth > 0 && (
                      <span className="text-gray-300 mr-2">└</span>
                    )}
                    {hasChildren ? (
                      <button
                        onClick={() => toggleExpanded(node.product.id)}
                        className="mr-1.5 rounded p-0.5 hover:bg-gray-100 shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown size={14} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={14} className="text-gray-400" />
                        )}
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}
                    <Link
                      href={`/products/${node.product.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {node.product.name}
                    </Link>
                    {!node.product.is_active && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        Inactive
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                  {node.product.sku}
                </td>
                <td className="px-4 py-3 text-sm">
                  {node.product.upc ? (
                    <span
                      className={`inline-flex items-center gap-1.5 font-mono ${
                        upcDuplicates.has(node.product.upc!)
                          ? "text-red-700 font-semibold"
                          : "text-gray-900"
                      }`}
                    >
                      {upcDuplicates.has(node.product.upc!) && (
                        <AlertTriangle size={12} className="text-red-500" />
                      )}
                      {node.product.upc}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {node.product.gtin ? (
                    <span
                      className={`inline-flex items-center gap-1.5 font-mono ${
                        gtinDuplicates.has(node.product.gtin!)
                          ? "text-red-700 font-semibold"
                          : "text-gray-900"
                      }`}
                    >
                      {gtinDuplicates.has(node.product.gtin!) && (
                        <AlertTriangle size={12} className="text-red-500" />
                      )}
                      {node.product.gtin}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {node.product.upc || node.product.gtin ? (
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                      <CheckCircle size={12} /> Assigned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                      <AlertTriangle size={12} /> Missing
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!node.product.upc && org?.upc_prefix && (
                      <button
                        onClick={() => generateUpc(node.product.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Auto-generate UPC"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Wand2 size={11} /> UPC
                        </span>
                      </button>
                    )}
                    {!node.product.gtin && org?.gtin_prefix && (
                      <button
                        onClick={() => generateGtin(node.product.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                        title="Auto-generate GTIN"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Wand2 size={11} /> GTIN
                        </span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {hasChildren && isExpanded && (
                <TreeRows nodes={node.children} />
              )}
            </Fragment>
          );
        })}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Prefix Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Barcode size={18} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Company Prefixes</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Set your GS1 company prefix to enable auto-generation of UPC and GTIN codes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* UPC Prefix */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
              UPC Company Prefix
            </div>
            {editingUpcPrefix ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={upcPrefixDraft}
                  onChange={(e) => setUpcPrefixDraft(e.target.value.replace(/\D/g, ""))}
                  maxLength={10}
                  placeholder="e.g. 0123456"
                  className="w-40 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => savePrefix("upc_prefix", upcPrefixDraft)}
                  disabled={savingPrefix}
                  className="rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => { setUpcPrefixDraft(org?.upc_prefix || ""); setEditingUpcPrefix(false); }}
                  className="rounded-md border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-mono ${org?.upc_prefix ? "text-gray-900" : "text-gray-400 italic"}`}>
                  {org?.upc_prefix || "Not set"}
                </span>
                <button
                  onClick={() => { setUpcPrefixDraft(org?.upc_prefix || ""); setEditingUpcPrefix(true); }}
                  className="rounded p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">6–10 digits assigned by GS1</p>
          </div>

          {/* GTIN Prefix */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
              GTIN Company Prefix
            </div>
            {editingGtinPrefix ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gtinPrefixDraft}
                  onChange={(e) => setGtinPrefixDraft(e.target.value.replace(/\D/g, ""))}
                  maxLength={12}
                  placeholder="e.g. 0012345"
                  className="w-40 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => savePrefix("gtin_prefix", gtinPrefixDraft)}
                  disabled={savingPrefix}
                  className="rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => { setGtinPrefixDraft(org?.gtin_prefix || ""); setEditingGtinPrefix(false); }}
                  className="rounded-md border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-mono ${org?.gtin_prefix ? "text-gray-900" : "text-gray-400 italic"}`}>
                  {org?.gtin_prefix || "Not set"}
                </span>
                <button
                  onClick={() => { setGtinPrefixDraft(org?.gtin_prefix || ""); setEditingGtinPrefix(true); }}
                  className="rounded p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">6–12 digits assigned by GS1</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-gray-500">{products.length} products total</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-600">{withUpc} with UPC</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-600">{withGtin} with GTIN</span>
        <span className="text-gray-400">·</span>
        {missing > 0 ? (
          <span className="text-amber-600">{missing} missing both</span>
        ) : (
          <span className="text-green-600">All products have identifiers</span>
        )}
        {totalDuplicates > 0 && (
          <>
            <span className="text-gray-400">·</span>
            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
              <AlertTriangle size={14} /> {totalDuplicates} duplicate{totalDuplicates !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>

      {/* Search + filter + expand/collapse */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or code..."
            className="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-72"
          />
        </div>

        <div className="flex gap-1">
          {(["all", "upc", "gtin", "missing", "duplicates"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              } ${f === "duplicates" && totalDuplicates > 0 ? "ring-1 ring-red-300" : ""}`}
            >
              {f === "all" && "All"}
              {f === "upc" && `Has UPC (${withUpc})`}
              {f === "gtin" && `Has GTIN (${withGtin})`}
              {f === "missing" && `Missing (${missing})`}
              {f === "duplicates" && `Duplicates (${totalDuplicates})`}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
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

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                UPC
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                GTIN
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Tree-structured products */}
            <TreeRows nodes={roots} />

            {/* Standalone products (not in any tree) */}
            {standalone.length > 0 && (
              <>
                {roots.length > 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-2">
                      <div className="border-t border-gray-200" />
                    </td>
                  </tr>
                )}
                {standalone
                  .filter((p) => matchesFilter(p) && matchesSearch(p))
                  .map((p) => (
                    <ProductRow key={p.id} product={p} depth={0} />
                  ))}
              </>
            )}
          </tbody>
        </table>

        {products.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">
            No products found.
          </div>
        )}
      </div>
    </div>
  );
}

// Need Fragment for the recursive component
import { Fragment } from "react";
