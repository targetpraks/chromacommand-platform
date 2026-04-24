import { TRPCProvider } from "./lib/trpc";
import { Sidebar } from "./components/Sidebar";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ChromaCommand — Papa Pasta Control Hub",
  description: "Unified RGB, Digital Menu, and Audio control for the Papa Pasta franchise network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0A0B14] text-white antialiased">
        <TRPCProvider>
          <div className="flex">
            <Sidebar />
            <main className="flex-1 ml-[240px] min-h-screen">{children}</main>
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
