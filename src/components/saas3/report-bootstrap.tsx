"use client";
import { useEffect } from "react";
import { ensureOperationalReportsAction } from "@/app/actions/chat-actions";
let lastAttempt = 0;
export function ReportBootstrap() {
  useEffect(() => {
    if (Date.now() - lastAttempt < 60000) return;
    lastAttempt = Date.now();
    void ensureOperationalReportsAction().catch(() =>
      console.warn(
        "[Raio-X] Não foi possível verificar relatórios nesta abertura.",
      ),
    );
  }, []);
  return null;
}
