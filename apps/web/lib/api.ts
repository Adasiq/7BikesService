import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from "./tokens";

// Базовый URL API из NEXT_PUBLIC_API_URL.
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

function makeError(status: number, data: unknown): ApiError {
  const message =
    (data as { message?: string | string[] })?.message ??
    `Request failed (${status})`;
  const err = new Error(
    Array.isArray(message) ? message.join(", ") : message,
  ) as ApiError;
  err.status = status;
  return err;
}

// Низкоуровневый вызов с явным токеном.
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
    // пустое тело
  }
  if (!res.ok) throw makeError(res.status, data);
  return data as T;
}

// Пытается обновить access-токен по refresh. Возвращает новый токен или null.
async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const r = await apiFetch<{ accessToken: string }>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
    setAccessToken(r.accessToken);
    return r.accessToken;
  } catch {
    return null;
  }
}

// Авторизованный JSON-вызов с одной попыткой refresh при 401.
export async function apiAuthed<T>(
  path: string,
  opts: Omit<ApiOptions, "token"> = {},
): Promise<T> {
  try {
    return await apiFetch<T>(path, { ...opts, token: getAccessToken() });
  } catch (e) {
    if ((e as ApiError).status === 401) {
      const fresh = await tryRefresh();
      if (fresh) return apiFetch<T>(path, { ...opts, token: fresh });
    }
    throw e;
  }
}

// Авторизованная загрузка файла (multipart) с одной попыткой refresh при 401.
export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const send = async (token: string | null): Promise<Response> =>
    fetch(API_URL + path, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      cache: "no-store",
    });

  let res = await send(getAccessToken());
  if (res.status === 401) {
    const fresh = await tryRefresh();
    if (fresh) res = await send(fresh);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // пустое тело
  }
  if (!res.ok) throw makeError(res.status, data);
  return data as T;
}
