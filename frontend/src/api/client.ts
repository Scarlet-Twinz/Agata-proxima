export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export type ApiError = { message: string; status: number; code?: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const csrf = sessionStorage.getItem("proxima_csrf") ?? "";
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? {"Content-Type":"application/json"} : {}),
      ...(csrf ? {"x-csrf-token": csrf} : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem("proxima_csrf");
      window.dispatchEvent(new CustomEvent("agata:session-expired"));
    }
    let message = response.status === 401
      ? "Your security session is no longer valid. Sign in again to continue."
      : `Request failed with status ${response.status}`;
    let code = "";
    try {
      const body = await response.json();
      if (typeof body?.message === "string") message = body.message;
      if (typeof body?.error === "string") code = body.error;
    } catch {}
    const error = new Error(message) as Error & ApiError;
    error.status = response.status;
    error.code = code;
    throw error;
  }

  const method = (options.method ?? "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";

  if (response.status === 204) {
    if (isMutation) {
      window.dispatchEvent(new CustomEvent("agata:data-changed", {
        detail: { method, path },
      }));
    }
    return undefined as T;
  }

  const data = await response.json() as T;
  if (isMutation) {
    window.dispatchEvent(new CustomEvent("agata:data-changed", {
      detail: { method, path },
    }));
  }
  return data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
