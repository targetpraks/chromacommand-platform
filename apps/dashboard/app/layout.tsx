import { TRPCProvider } from "./lib/trpc";
import { AppShell } from "./components/AppShell";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ChromaCommand — Papa Pasta Control Hub",
  description: "Unified RGB, Digital Menu, and Audio control for the Papa Pasta franchise network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-dark text-on-dark antialiased">
        <TRPCProvider>
          <AppShell>{children}</AppShell>
        </TRPCProvider>
      </body>
    </html>
  );
}