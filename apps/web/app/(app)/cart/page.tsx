"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { apiAuthed, API_ORIGIN } from "../../../lib/api";
import { useCart, CartItem } from "../../../lib/cart-context";

export default function CartPage() {
  const { items, setQty, remove, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  // Группировка по поставщику — заказ создаётся по одному на поставщика.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: CartItem[] }>();
    for (const it of items) {
      const g = map.get(it.supplierId) ?? { name: it.supplierName, items: [] };
      g.items.push(it);
      map.set(it.supplierId, g);
    }
    return [...map.values()];
  }, [items]);

  function groupTotal(list: CartItem[]) {
    return list.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  }

  async function checkout() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiAuthed<{ orders: unknown[] }>("/orders/checkout", {
        method: "POST",
        body: { items: items.map((i) => ({ productId: i.productId, qty: i.qty })) },
      });
      setDone(res.orders.length);
      clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка оформления");
    } finally {
      setSubmitting(false);
    }
  }

  if (done !== null) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Заказ оформлен</h1>
        <p className="mt-2 text-slate-600">
          Создано заказов: {done}. Они отправлены поставщикам.
        </p>
        <Link
          href="/orders"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          К моим заказам
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Корзина</h1>
        <p className="mt-2 text-slate-500">Корзина пуста.</p>
        <Link
          href="/catalog"
          className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          Перейти в каталог
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Корзина</h1>
      <p className="mt-1 text-sm text-slate-500">
        Позиции сгруппированы по поставщикам — будет создано {groups.length}{" "}
        заказ(ов).
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <div
            key={g.name}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-medium">
              {g.name}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {g.items.map((it) => (
                  <tr key={it.productId} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.imageUrl ? (
                        <img
                          src={API_ORIGIN + it.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-slate-100" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div>{it.name}</div>
                      <div className="font-mono text-xs text-slate-400">
                        {it.sku}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {it.price} {it.currency}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) =>
                          setQty(it.productId, parseInt(e.target.value, 10) || 1)
                        }
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-center"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                      {(Number(it.price) * it.qty).toFixed(2)} {it.currency}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => remove(it.productId)}
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-4 py-2 text-right text-sm">
              Итого по поставщику:{" "}
              <span className="font-semibold">
                {groupTotal(g.items).toFixed(2)} {g.items[0]?.currency}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={checkout}
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? "Оформление…" : "Оформить заказ"}
        </button>
        <button
          onClick={clear}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          Очистить
        </button>
      </div>
    </div>
  );
}
