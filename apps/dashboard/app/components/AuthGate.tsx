"use client";
import React from "react";

/**
 * Auth gate — currently bypassed for development.
 * Restore JWT-check logic when auth is needed again.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
