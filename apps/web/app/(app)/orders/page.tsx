"use client";

import { useCallback, useEffect, useState } from "react";
import { apiAuthed } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type Status = "NEW" | "ACCEPTED" | "ASSEMBLED" | "SHIPPED" | "CANCELLED";

interface OrderItem {
  id: string;
  skuSnapshot: string;
  nameSnapshot: string;
  qty: number;
  priceSnapshot: string;
}
interface Order {
  id: string;
  status: Status;
  createdAt: string;
  supplier: { id: string; name: string };
  workshop: { id: string; name: string };
  items: OrderItem[];
}

const SUPPLIER_ROLES = ["SUPPLIER_ADMIN", "SUPPLIER_STAFF"];

const statusLabel: Record<Status, string> = {
  NEW: "Новый",
  ACCEPTED: "Принят",
  ASSEMBLED: "Собран",
  SHIPPED: "Отгружен",
  CANCELLED: "Отменён",
};
const statusStyle: Record<Status, string> = {
  NEW: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-amber-50 text-amber-700",
  ASSEMBLED: "bg-violet-50 text-violet-700",
  SHIPPED: "bg-green-50 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};
const NEXT: Record<Status, Status[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["ASSEMBLED", "CANCELLED"],
  ASSEMBLED: ["SHIPPED", "CANCELLED"],
  SHIPPED: [],
  CANCELLED: [],
};

export default function OrdersPage() {
  const { user } = useAuth();
  const isSupplier = !!user && SUPPLIER_ROLES.includes(user.role);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await apiAuthed<Order[]>("/orders"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: Status) {
    try {
      await apiAuthed(`/orders/${id}/status`, { method: "PATCH", body: { status } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка смены статуса");
    }
  }

  function total(o: Order) {
    return o.items.reduce((s, i) => s + Number(i.priceSnapshot) * i.qty, 0);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {isSupplier ? "Входящие заказы" : "Мои заказы"}
      </h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading && <p className="mt-4 text-sm text-slate-400">Загрузка…</p>}
      {!loading && orders.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">Заказов пока нет.</p>
      )}

      <div className="mt-6 space-y-5">
        {orders.map((o) => (
          <div
            key={o.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <div className="text-sm font-medium">
                  {isSupplier ? o.workshop.name : o.supplier.name}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(o.createdAt).toLocaleString("ru-RU")} · №{" "}
                  {o.id.slice(-6)}
                </div>
              </div>
              <span
                className={`rounded-md px-2 py-0.5 text-xs ${statusStyle[o.status]}`}
              >
                {statusLabel[o.status]}
              </span>
            </div>

            <table className="w-full text-sm">
              <tbody>
                {o.items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-4 py-1.5 font-mono text-xs text-slate-400">
                      {it.skuSnapshot}
                    </td>
                    <td className="px-2 py-1.5">{it.nameSnapshot}</td>
                    <td className="px-2 py-1.5 text-right text-slate-500">
                      ×{it.qty}
                    </td>
                    <td className="px-4 py-1.5 text-right whitespace-nowrap">
                      {(Number(it.priceSnapshot) * it.qty).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2">
              <div className="text-sm">
                Итого: <span className="font-semibold">{total(o).toFixed(2)}</span>
              </div>
              {isSupplier && NEXT[o.status].length > 0 && (
                <div className="flex gap-2">
                  {NEXT[o.status].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(o.id, s)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                        s === "CANCELLED"
                          ? "border border-slate-300 hover:bg-slate-100"
                          : "bg-slate-900 text-white hover:bg-slate-700"
                      }`}
                    >
                      {s === "CANCELLED"
                        ? "Отменить"
                        : `→ ${statusLabel[s]}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
