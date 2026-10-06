"use client";

import { useEffect } from "react";
import { useErrorBanner } from "./ErrorBannerProvider";

/**
 * Surfaces an error a server action redirected back with as `?error=...`
 * through the global red banner instead of leaving it as easy-to-miss page
 * text, so it's consistent with every other error path in the app.
 */
export function QueryErrorBanner({ error }: { error?: string }) {
  const { reportError } = useErrorBanner();

  useEffect(() => {
    if (error) reportError(error);
  }, [error, reportError]);

  return null;
}
