"use client";

import { useCallback, useEffect, useState } from "react";
import { apiAuthed } from "../../../lib/api";

interface Product {
  id: string;
  sku: string;
  name: string;
  price: string; // Prisma Decimal -> строка в JSON
  currency: string;
  stockQty: number;
  attrs?: { stockText?: string; unit?: string } | null;
}

interface ProductList {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 20;

export default function CatalogPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ProductList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) params.set("search", search);
      const res = await apiAuthed<ProductList>(
        `/catalog/products?${params.toString()}`,
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(query.trim());
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / LIMIT)) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold">Каталог</h1>
      <p className="mt-1 text-sm text-slate-500">
        {result ? `Найдено: ${result.total}` : "—"}
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию или артикулу…"
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Найти
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Артикул</th>
              <th className="px-4 py-2 font-medium">Наименование</th>
              <th className="px-4 py-2 text-right font-medium">Цена</th>
              <th className="px-4 py-2 text-right font-medium">Остаток</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && result?.data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
            {!loading &&
              result?.data.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {p.sku}
                  </td>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {p.price} {p.currency}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">
                    {p.attrs?.stockText ?? p.stockQty}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {result && result.total > LIMIT && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-slate-500">
            Стр. {page} из {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}
