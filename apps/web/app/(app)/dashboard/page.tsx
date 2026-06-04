"use client";

import { useAuth } from "../../../lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold">Панель</h1>
      <p className="mt-2 text-slate-600">
        Вы вошли в систему. Это защищённый раздел.
      </p>

      <dl className="mt-6 grid max-w-md gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-sm">
        <Row label="Имя" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row label="Роль" value={user.role} />
        <Row label="Tenant" value={user.tenantId ?? "— (системный)"} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between bg-white px-4 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
