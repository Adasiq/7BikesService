"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiAuthed, apiUpload } from "../../../lib/api";

interface Batch {
  id: string;
  fileRef: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  rowsOk: number;
  rowsErr: number;
  importedAt: string;
  errorLog?: {
    scanned?: number;
    deduped?: number;
    deactivated?: number;
    message?: string;
  } | null;
}

const statusStyle: Record<string, string> = {
  COMPLETED: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
  PROCESSING: "bg-amber-50 text-amber-700",
  PENDING: "bg-slate-100 text-slate-600",
};

export default function ImportPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadBatches = useCallback(async () => {
    try {
      setBatches(await apiAuthed<Batch[]>("/import/batches"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки истории");
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Выберите файл прайса");
      return;
    }
    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const batch = await apiUpload<Batch>("/import/batches", fd);
      setNotice(
        `Импорт завершён: ${batch.rowsOk} товаров, пропущено ${batch.rowsErr}` +
          (batch.errorLog?.deduped
            ? `, дублей схлопнуто ${batch.errorLog.deduped}`
            : ""),
      );
      if (fileRef.current) fileRef.current.value = "";
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка импорта");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Импорт прайса</h1>
      <p className="mt-1 text-sm text-slate-500">
        Загрузите Excel-файл прайса. Каталог обновится по нему полностью.
      </p>

      <form
        onSubmit={onUpload}
        className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
        />
        <button
          type="submit"
          disabled={uploading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {uploading ? "Импорт…" : "Загрузить"}
        </button>
      </form>

      {notice && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
        История загрузок
      </h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Дата</th>
              <th className="px-4 py-2 font-medium">Файл</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 text-right font-medium">Товаров</th>
              <th className="px-4 py-2 text-right font-medium">Пропущено</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Загрузок пока нет
                </td>
              </tr>
            )}
            {batches.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                  {new Date(b.importedAt).toLocaleString("ru-RU")}
                </td>
                <td className="px-4 py-2">{b.fileRef.replace(/^upload:/, "")}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs ${
                      statusStyle[b.status] ?? ""
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{b.rowsOk}</td>
                <td className="px-4 py-2 text-right text-slate-500">
                  {b.rowsErr}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
