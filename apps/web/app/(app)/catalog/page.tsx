"use client";

import { useCallback, useEffect, useState } from "react";
import { apiAuthed, API_ORIGIN } from "../../../lib/api";

interface Product {
  id: string;
  sku: string;
  name: string;
  price: string;
  currency: string;
  stockQty: number;
  category: string | null;
  imageUrl: string | null;
  attrs?: { stockText?: string } | null;
}

interface ProductList {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

interface Category {
  category: string;
  count: number;
}

const LIMIT = 20;

export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ProductList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiAuthed<Category[]>("/catalog/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) params.set("search", search);
      if (activeCat) params.set("category", activeCat);
      setResult(await apiAuthed<ProductList>(`/catalog/products?${params}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [page, search, activeCat]);

  useEffect(() => {
    load();
  }, [load]);

  function selectCategory(cat: string | null) {
    setActiveCat(cat);
    setPage(1);
  }
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

      <div className="mt-4 flex gap-6">
        {/* Категории */}
        <aside className="w-60 shrink-0">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              onClick={() => selectCategory(null)}
              className={`block w-full px-3 py-2 text-left text-sm ${
                activeCat === null
                  ? "bg-slate-900 text-white"
                  : "hover:bg-slate-50"
              }`}
            >
              Все категории
            </button>
            <div className="max-h-[70vh] overflow-y-auto">
              {categories.map((c) => (
                <button
                  key={c.category}
                  onClick={() => selectCategory(c.category)}
                  className={`flex w-full items-center justify-between border-t border-slate-100 px-3 py-2 text-left text-sm ${
                    activeCat === c.category
                      ? "bg-slate-100 font-medium"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate pr-2">{c.category}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {c.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Список товаров */}
        <div className="min-w-0 flex-1">
          <form onSubmit={onSubmit} className="flex gap-2">
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

          {activeCat && (
            <p className="mt-3 text-sm text-slate-500">
              Категория: <span className="font-medium">{activeCat}</span>{" "}
              <button
                onClick={() => selectCategory(null)}
                className="text-slate-400 underline"
              >
                сбросить
              </button>
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="w-14 px-3 py-2 font-medium"></th>
                  <th className="px-3 py-2 font-medium">Артикул</th>
                  <th className="px-3 py-2 font-medium">Наименование</th>
                  <th className="px-3 py-2 text-right font-medium">Цена</th>
                  <th className="px-3 py-2 text-right font-medium">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Загрузка…
                    </td>
                  </tr>
                )}
                {!loading && result?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Ничего не найдено
                    </td>
                  </tr>
                )}
                {!loading &&
                  result?.data.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.imageUrl ? (
                          <img
                            src={API_ORIGIN + p.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-slate-100" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">
                        {p.sku}
                      </td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {p.price} {p.currency}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">
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
      </div>
    </div>
  );
}
