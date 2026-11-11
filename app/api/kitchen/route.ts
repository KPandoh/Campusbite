import { NextResponse } from "next/server";
import { z } from "zod";
import { formatSlot } from "@/lib/campusbite";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateOrderStatusSchema = z.object({
  order_id: z.number().int().positive(),
  status: z.enum(["placed", "preparing", "ready", "collected", "cancelled"]),
});

export async function GET() {
  const { data, error } = await getSupabase()
    .from("orders")
    .select("id, status, total, created_at, wallets(name), pickup_slots(slot_time), order_items(quantity, menu_items(name))")
    .in("status", ["placed", "preparing", "ready"])
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[GET /api/kitchen]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = data.map((order) => {
    const student = Array.isArray(order.wallets) ? order.wallets[0] : order.wallets;
    const pickup = Array.isArray(order.pickup_slots) ? order.pickup_slots[0] : order.pickup_slots;
    return {
      id: order.id,
      status: order.status,
      total: order.total,
      student_name: student?.name ?? null,
      pickup_time: pickup?.slot_time ? formatSlot(pickup.slot_time) : null,
      items: order.order_items.flatMap((item) => {
        const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
        return menuItem ? [{ name: menuItem.name, quantity: item.quantity }] : [];
      }),
    };
  });

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order status update", details: parsed.error.issues }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", parsed.data.order_id)
    .maybeSingle();
  if (readError) {
    console.error("[POST /api/kitchen read]", readError.message);
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const nextStatus: Record<string, string> = {
    placed: "preparing",
    preparing: "ready",
    ready: "collected",
  };
  if (nextStatus[order.status] !== parsed.data.status) {
    return NextResponse.json({ error: "Order status can only move to the next step" }, { status: 409 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.order_id)
    .eq("status", order.status)
    .select("id, status")
    .maybeSingle();
  if (updateError) {
    console.error("[POST /api/kitchen update]", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Order status changed; refresh and try again" }, { status: 409 });
  }

  return NextResponse.json({ order: updated });
}
