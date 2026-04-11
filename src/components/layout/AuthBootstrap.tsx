"use client";

import { useAuth } from "@/hooks/useAuth";

export function AuthBootstrap() {
  useAuth();
  return null;
}
