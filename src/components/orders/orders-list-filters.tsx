"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { ORDER_STATUSES } from "@/lib/constants";

interface Props {
  status: string | null;
  q: string;
}

const STATUS_KEYS = Object.keys(ORDER_STATUSES) as Array<
  keyof typeof ORDER_STATUSES
>;

/**
 * Filter bar for the orders list. Status is a chip group; search is a text
 * input that submits on Enter (and clears via the X button). State lives in
 * the URL so the page can be linked/refreshed with filters intact.
 */
export function OrdersListFilters({ status, q }: Props) {
  const router = useRouter();
  // Local input value so the user can type without each keystroke firing
  // a navigation. Submit on Enter (or via the form's submit).
  const [searchValue, setSearchValue] = useState(q);

  // Sync local state if the URL changes externally (e.g. clicking a chip
  // refreshes the page with a different ?q=).
  useEffect(() => {
    setSearchValue(q);
  }, [q]);

  const buildHref = (next: { status?: string | null; q?: string | null }) => {
    const params = new URLSearchParams();
    const nextStatus =
      next.status !== undefined ? next.status : status;
    const nextQ = next.q !== undefined ? next.q : q;
    if (nextStatus) params.set("status", nextStatus);
    if (nextQ) params.set("q", nextQ);
    const qs = params.toString();
    return qs ? `/orders?${qs}` : "/orders";
  };

  const setStatus = (s: string | null) => {
    router.push(buildHref({ status: s }));
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildHref({ q: searchValue.trim() || null }));
  };

  const clearSearch = () => {
    setSearchValue("");
    router.push(buildHref({ q: null }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatus(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            !status
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {STATUS_KEYS.map((key) => {
          const meta = ORDER_STATUSES[key];
          const active = status === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(active ? null : key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? meta.color + " ring-2 ring-offset-1 ring-gray-400"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submitSearch} className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search by order number or customer…"
          className="w-full rounded-lg border border-gray-300 pl-9 pr-9 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {searchValue && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </form>
    </div>
  );
}
