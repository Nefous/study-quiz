import type { ApiError } from "./types";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw { message: "Invalid JSON response", status: response.status } satisfies ApiError;
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${baseURL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.text();
    const message = body || response.statusText || "Request failed";
    throw { message, status: response.status } satisfies ApiError;
  }

  return parseJson<T>(response);
}
