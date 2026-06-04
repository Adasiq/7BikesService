import { UserRole } from "@7bs/shared";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Супер-админ",
  SUPPLIER_ADMIN: "Поставщик (админ)",
  SUPPLIER_STAFF: "Сотрудник поставщика",
  WORKSHOP_ADMIN: "Мастерская (админ)",
  MECHANIC: "Мастер",
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">7BS</h1>
      <p className="mt-2 text-slate-600">
        CRM для веломастерских с интеграцией поставщиков. Каркас проекта поднят.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Роли системы
        </h2>
        <ul className="mt-3 grid gap-2">
          {Object.values(UserRole).map((role) => (
            <li
              key={role}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
            >
              <span>{roleLabels[role] ?? role}</span>
              <code className="text-xs text-slate-400">{role}</code>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Список выше импортирован из{" "}
          <code>@7bs/shared</code> — общий пакет работает.
        </p>
      </section>
    </main>
  );
}
