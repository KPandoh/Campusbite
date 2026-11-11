"use client";

import { useEffect, useState } from "react";

type Order = {
  id: number;
  status: "placed" | "preparing" | "ready" | "collected" | "cancelled";
  total: number;
  pickup_time: string | null;
  items: string[];
};

type MeResponse = {
  wallet: { name: string; balance: number };
  orders: Order[];
};

const STATUS_STYLES: Record<Order["status"], string> = {
  placed: "bg-amber-100 text-amber-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-emerald-100 text-emerald-800",
  collected: "bg-slate-200 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
};

export default function WalletOrders({ refreshKey }: { refreshKey: number }) {
  const [wallet, setWallet] = useState<MeResponse["wallet"] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let loading = false;

    async function load() {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("/api/me");
        const data = (await response.json()) as MeResponse & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load wallet and orders");
        if (active) {
          setWallet(data.wallet);
          setOrders(data.orders);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load wallet and orders");
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="rounded-2xl bg-slate-950 p-5 text-white">
        <p className="text-sm text-slate-300">CampusBite wallet</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-300">{wallet?.name ?? "Loading student..."}</p>
            <h2 className="mt-1 text-3xl font-semibold">Rs {wallet?.balance ?? "—"}</h2>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">SRM student</span>
        </div>
      </div>

      <div className="p-4">
        <h2 className="font-semibold text-slate-900">My orders today</h2>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!error && orders.length === 0 && (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No orders today yet.</p>
        )}
        <ul className="mt-3 space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Order #{order.id}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Pickup {order.pickup_time ?? "time unavailable"}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[order.status]}`}>
                  {order.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{order.items.length ? order.items.join(", ") : "Items unavailable"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Total: Rs {order.total}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
