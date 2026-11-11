import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import { getSupabase } from "../supabase";
import { CURRENT_STUDENT_ID, formatSlot } from "../campusbite";

const getMenu = defineTool({
  name: "getMenu",
  description: "Use this when the user asks what food is available or wants menu recommendations.",
  schema: z.object({
    category: z.enum(["meal", "snack", "drink", "sweet"]).optional().describe("Filter by menu category."),
    veg_only: z.boolean().optional().describe("When true, return vegetarian items only."),
    max_price: z.number().int().optional().describe("Maximum item price in whole rupees."),
  }),
  run: async ({ category, veg_only, max_price }) => {
    let query = getSupabase()
      .from("menu_items")
      .select("id, name, category, price, is_veg, stock, description")
      .gt("stock", 0)
      .order("category")
      .order("price");
    if (category) query = query.eq("category", category);
    if (veg_only) query = query.eq("is_veg", true);
    if (max_price !== undefined) query = query.lte("price", max_price);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { items: data };
  },
});

const getWalletBalance = defineTool({
  name: "getWalletBalance",
  description: "Use this when the user asks about their wallet or before checking if they can afford an order.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("wallets")
      .select("name, balance")
      .eq("student_id", CURRENT_STUDENT_ID)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
});

const getPickupSlots = defineTool({
  name: "getPickupSlots",
  description: "Use this when the user asks about pickup times or needs to choose a pickup slot.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("pickup_slots")
      .select("id, slot_time, capacity, booked")
      .order("slot_time");
    if (error) throw new Error(error.message);

    return {
      slots: data
        .map((slot) => ({
          slot_id: slot.id,
          time: formatSlot(slot.slot_time),
          free: slot.capacity - slot.booked,
        }))
        .filter((slot) => slot.free > 0),
    };
  },
});

const getMyOrders = defineTool({
  name: "getMyOrders",
  description: "Use this when the user asks about their recent orders or their order status.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("orders")
      .select("id, status, total, pickup_slots(slot_time), order_items(menu_items(name))")
      .eq("student_id", CURRENT_STUDENT_ID)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    return {
      orders: data.map((order) => {
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
      }),
    };
  },
});

const placeOrder = defineTool({
  name: "placeOrder",
  description: "Use this when the user wants to place a canteen order.",
  writes: true,
  schema: z.object({
    items: z
      .array(
        z.object({
          menu_item_id: z.number().int().positive().describe("ID of a menu item."),
          quantity: z.number().int().min(1).max(5).describe("Quantity to order, from 1 to 5."),
        })
      )
      .min(1)
      .describe("At least one menu item and its quantity."),
    slot_id: z.number().int().positive().describe("ID of the selected pickup slot."),
  }),
  run: async ({ items, slot_id }) => {
    const { data, error } = await getSupabase().rpc("place_order", {
      p_student_id: CURRENT_STUDENT_ID,
      p_slot_id: slot_id,
      p_items: items,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

const cancelOrder = defineTool({
  name: "cancelOrder",
  description: "Use this when the user wants to cancel one of their orders.",
  writes: true,
  schema: z.object({
    order_id: z.number().int().positive().describe("ID of the order to cancel."),
  }),
  run: async ({ order_id }) => {
    const { data, error } = await getSupabase().rpc("cancel_order", {
      p_student_id: CURRENT_STUDENT_ID,
      p_order_id: order_id,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

export const tools: AgentTool[] = [
  getMenu,
  getWalletBalance,
  getPickupSlots,
  getMyOrders,
  placeOrder,
  cancelOrder,
];
