// Тонкий клиент к API. Базовый URL берётся из NEXT_PUBLIC_API_URL.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface ApiError extends Error {
  status: number;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T>(
  path: string,
  { method = "GET", body, token }: ApiOptions = {},
): Promise<T> {
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // тело может быть пустым
  }

  if (!res.ok) {
    const message =
      (data as { message?: string | string[] })?.message ??
      `Request failed (${res.status})`;
    const error = new Error(
      Array.isArray(message) ? message.join(", ") : message,
    ) as ApiError;
    error.status = res.status;
    throw error;
  }

  return data as T;
}
