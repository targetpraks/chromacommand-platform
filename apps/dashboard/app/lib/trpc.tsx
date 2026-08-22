"use client";
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import type { AppRouter } from "@chromacommand/shared";

export const trpc = createTRPCReact<AppRouter>();

const TOKEN_KEY = "cc_access_token";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

export function getToken(): string | null {
  return getCookie(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof document === "undefined") return;
  if (token) {
    document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=86400; SameSite=Strict`;
  } else {
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    // Client-side: use relative path (proxied by Next.js rewrite to the API container)
    return "/api/trpc";
  }
  // Server-side: direct Docker network call
  return "http://api:4000/api/trpc";
};

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchInterval: false, staleTime: 60000 } },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}`,
          headers() {
            const token = getToken();
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
