import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the Express API server
 * Set EXPO_PUBLIC_USE_GCP=true to use Google Cloud backend
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  const useGcp = process.env.EXPO_PUBLIC_USE_GCP === "true";
  const gcpHost = process.env.EXPO_PUBLIC_GCP_DOMAIN;
  const localHost = process.env.EXPO_PUBLIC_DOMAIN;

  let host: string;
  
  if (useGcp && gcpHost) {
    host = gcpHost;
  } else if (localHost) {
    host = localHost;
  } else {
    throw new Error("No API domain configured");
  }

  // Use HTTP for IP addresses, HTTPS for domains
  const protocol = host.match(/^\d+\.\d+\.\d+\.\d+/) ? "http" : "https";
  let url = new URL(`${protocol}://${host}`);

  return url.href;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
