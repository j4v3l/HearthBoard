
  import React from "react";
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    state = { error: null };

    static getDerivedStateFromError(error: Error) {
      return { error };
    }

    componentDidCatch(error: Error) {
      console.error("Hearthboard crashed", error);
    }

    render() {
      if (!this.state.error) return this.props.children;
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl shadow-black/30">
            <h1 className="text-base font-semibold mb-2">Hearthboard hit a display error</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Refresh the page. If it keeps happening, clear this site&apos;s cache and try again.
            </p>
            <pre className="text-xs text-red-300 whitespace-pre-wrap rounded-md border border-red-400/20 bg-red-400/10 p-3">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(() => {});
  }

  if ("caches" in window) {
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .catch(() => {});
  }

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  
