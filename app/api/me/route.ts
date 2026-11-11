import { NextResponse } from "next/server";
import { CURRENT_STUDENT_ID, formatSlot } from "@/lib/campusbite";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  const [walletResult, ordersResult] = await Promise.all([
    supabase
      .from("wallets")
      .select("name, balance")
      .eq("student_id", CURRENT_STUDENT_ID)
      .single(),
    supabase
      .from("orders")
      .select("id, status, total, pickup_slots(slot_time), order_items(menu_items(name))")
      .eq("student_id", CURRENT_STUDENT_ID)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (walletResult.error) {
    console.error("[GET /api/me wallet]", walletResult.error.message);
    return NextResponse.json({ error: walletResult.error.message }, { status: 500 });
  }
  if (ordersResult.error) {
    console.error("[GET /api/me orders]", ordersResult.error.message);
    return NextResponse.json({ error: ordersResult.error.message }, { status: 500 });
  }

  const orders = ordersResult.data.map((order) => {
    const pickup = Array.isArray(order.pickup_slots) ? order.pickup_slots[0] : order.pickup_slots;
    return {
      id: order.id,
      status: order.status,
      total: order.total,
      pickup_time: pickup?.slot_time ? formatSlot(pickup.slot_time) : null,
      items: order.order_items
        .map((item) => {
          const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
          return menuItem?.name;
        })
        .filter((name): name is string => Boolean(name)),
    };
  });

  return NextResponse.json({ wallet: walletResult.data, orders });
}
