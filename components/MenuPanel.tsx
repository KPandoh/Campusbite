"use client";

import { useEffect, useState } from "react";

type MenuItem = {
  id: number;
  name: string;
  category: "meal" | "snack" | "drink" | "sweet";
  price: number;
  is_veg: boolean;
  stock: number;
  description: string;
};

const CATEGORIES: { key: MenuItem["category"]; label: string }[] = [
  { key: "meal", label: "Meals" },
  { key: "snack", label: "Snacks" },
  { key: "sweet", label: "Sweets" },
  { key: "drink", label: "Drinks" },
];

export default function MenuPanel({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let loading = false;

    async function load() {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("/api/menu");
        const data = (await response.json()) as { items?: MenuItem[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load today's menu");
        if (active) {
          setItems(data.items ?? []);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load today's menu");
      } finally {
        loading = false;
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-slate-900">Today&apos;s menu</h2>
        <p className="text-xs text-slate-500">Availability and prices update live.</p>
      </div>
      <div className="space-y-5 p-4">
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!error && items.length === 0 && (
          <p className="text-sm text-slate-500">Loading menu...</p>
        )}
        {CATEGORIES.map(({ key, label }) => {
          const categoryItems = items.filter((item) => item.category === key);
          return (
            <section key={key}>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{label}</h3>
              {categoryItems.length === 0 ? (
                <p className="text-xs text-slate-400">{error ? "Menu unavailable" : "No items listed"}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {categoryItems.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          aria-label={item.is_veg ? "Vegetarian" : "Non-vegetarian"}
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.is_veg ? "bg-emerald-500" : "bg-red-500"}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.description}</p>
                          {item.stock === 0 ? (
                            <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              Sold out
                            </span>
                          ) : item.stock <= 3 ? (
                            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Only {item.stock} left
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-900">Rs {item.price}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
