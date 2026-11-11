"use client";

import { useEffect, useState } from "react";

type OrderStatus = "placed" | "preparing" | "ready";
type NextStatus = "preparing" | "ready" | "collected";

type KitchenOrder = {
  id: number;
  status: OrderStatus;
  total: number;
  student_name: string | null;
  pickup_time: string | null;
  items: { name: string; quantity: number }[];
};

const COLUMNS: { status: OrderStatus; title: string; action: string; next: NextStatus }[] = [
  { status: "placed", title: "New orders", action: "Start preparing", next: "preparing" },
  { status: "preparing", title: "Preparing", action: "Mark ready", next: "ready" },
  { status: "ready", title: "Ready for pickup", action: "Collected", next: "collected" },
];

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let fetching = false;

    async function loadOrders() {
      if (fetching) return;
      fetching = true;
      try {
        const response = await fetch("/api/kitchen");
        const data = (await response.json()) as { orders?: KitchenOrder[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load kitchen orders");
        if (active) {
          setOrders(data.orders ?? []);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load kitchen orders");
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    }

    void loadOrders();
    const interval = window.setInterval(() => void loadOrders(), 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  async function advanceOrder(orderId: number, status: NextStatus) {
    setUpdatingOrderId(orderId);
    setError("");
    try {
      const response = await fetch("/api/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, status }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update order");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-screen-2xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">CampusBite · SRM</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Kitchen board</h1>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1.5 text-sm font-medium text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live
          </span>
        </header>

        {error && <p className="mb-5 rounded-xl border border-red-900 bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}

        <div className="grid items-start gap-5 lg:grid-cols-3">
          {COLUMNS.map((column) => {
            const columnOrders = orders.filter((order) => order.status === column.status);
            return (
              <section key={column.status} className="min-h-64 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{column.title}</h2>
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                    {columnOrders.length}
                  </span>
                </div>
                {loading && columnOrders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">Loading orders...</p>
                ) : columnOrders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">No orders here.</p>
                ) : (
                  <ul className="space-y-3">
                    {columnOrders.map((order) => (
                      <li key={order.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-lg shadow-black/10">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold text-white">Order #{order.id}</h3>
                          <span className="rounded-md bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300">
                            Pickup {order.pickup_time ?? "—"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">{order.student_name ?? "Student"}</p>
                        <ul className="mt-3 space-y-1 text-sm text-slate-200">
                          {order.items.map((item, index) => (
                            <li key={`${item.name}-${index}`}>
                              {item.quantity} × {item.name}
                            </li>
                          ))}
                          {order.items.length === 0 && <li className="text-slate-500">Items unavailable</li>}
                        </ul>
                        <div className="mt-4 flex items-center justify-between border-t border-slate-700 pt-3">
                          <span className="text-sm font-semibold text-white">Rs {order.total}</span>
                          <button
                            type="button"
                            onClick={() => advanceOrder(order.id, column.next)}
                            disabled={updatingOrderId === order.id}
                            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
                          >
                            {updatingOrderId === order.id ? "Updating..." : column.action}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
