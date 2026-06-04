"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Супер-админ",
  SUPPLIER_ADMIN: "Поставщик (админ)",
  SUPPLIER_STAFF: "Сотрудник поставщика",
  WORKSHOP_ADMIN: "Мастерская (админ)",
  MECHANIC: "Мастер",
};

const SUPPLIER_ROLES = ["SUPPLIER_ADMIN", "SUPPLIER_STAFF"];
const CATALOG_ROLES = [
  "MECHANIC",
  "WORKSHOP_ADMIN",
  "SUPPLIER_ADMIN",
  "SUPPLIER_STAFF",
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Загрузка…
      </div>
    );
  }

  const nav: { href: string; label: string }[] = [
    { href: "/dashboard", label: "Панель" },
  ];
  if (CATALOG_ROLES.includes(user.role))
    nav.push({ href: "/catalog", label: "Каталог" });
  if (SUPPLIER_ROLES.includes(user.role))
    nav.push({ href: "/import", label: "Импорт прайса" });

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold">7BS</span>
            <nav className="flex items-center gap-1 text-sm">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-1.5 transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">
              {user.name}{" "}
              <span className="text-slate-400">
                · {roleLabels[user.role] ?? user.role}
              </span>
            </span>
            <button
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="rounded-lg border border-slate-300 px-3 py-1 transition hover:bg-slate-100"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
