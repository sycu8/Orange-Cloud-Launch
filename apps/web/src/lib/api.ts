export type ApiError = {
  code: string;
  message: string;
  requestId: string;
  retryable: boolean;
  nextAction?: string;
};

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken() {
  return csrfToken;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (csrfToken && init.method && init.method !== "GET" && init.method !== "HEAD") {
    headers.set("X-CSRF-Token", csrfToken);
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as ApiError;
    throw Object.assign(new Error(err.message || res.statusText), {
      api: err,
      status: res.status,
    });
  }
  return data as T;
}
