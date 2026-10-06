"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface Banner {
  id: number;
  message: string;
}

interface ErrorBannerContextValue {
  /** Shows a red banner across the top of the page with a plain-English message - for any failure a user could otherwise never notice. */
  reportError: (message: string) => void;
}

const ErrorBannerContext = createContext<ErrorBannerContextValue | null>(null);

export function useErrorBanner() {
  const ctx = useContext(ErrorBannerContext);
  if (!ctx) throw new Error("useErrorBanner must be used within ErrorBannerProvider");
  return ctx;
}

let nextBannerId = 1;

/**
 * Lives at the root of the layout, above everything else, so every page and
 * every background fetch (now-playing, changelog, meme library, etc.) can
 * surface a failure instead of only logging it to a console nobody on a
 * deployed server is watching. Also catches genuinely uncaught exceptions
 * and unhandled promise rejections globally, so nothing fails silently even
 * from code that never calls reportError directly.
 */
export function ErrorBannerProvider({ children }: { children: React.ReactNode }) {
  const [banners, setBanners] = useState<Banner[]>([]);

  const reportError = useCallback((message: string) => {
    const id = nextBannerId++;
    setBanners((current) => [...current, { id, message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setBanners((current) => current.filter((banner) => banner.id !== id));
  }, []);

  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportError(event.message || "Something went wrong.");
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      reportError(reason instanceof Error ? reason.message : String(reason ?? "Something went wrong."));
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [reportError]);

  return (
    <ErrorBannerContext.Provider value={{ reportError }}>
      {banners.length > 0 && (
        <div className="error-banner-stack">
          {banners.map((banner) => (
            <div key={banner.id} className="error-banner" role="alert">
              <span className="error-banner-icon" aria-hidden="true">⚠️</span>
              <span className="error-banner-message">{banner.message}</span>
              <button
                type="button"
                className="error-banner-dismiss"
                aria-label="Dismiss error"
                onClick={() => dismiss(banner.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {children}
    </ErrorBannerContext.Provider>
  );
}
