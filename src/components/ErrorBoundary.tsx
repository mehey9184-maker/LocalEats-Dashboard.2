import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Trash2, Copy, Check } from "lucide-react";
import { LocalEatsLogo } from "./LocalEatsLogo";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary caught unhandled exception]:", error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleClearCacheAndReload = (): void => {
    try {
      localStorage.removeItem("localeats_cached_shops");
      localStorage.removeItem("localeats_cached_menu_items");
      localStorage.removeItem("localeats_cached_orders");
      localStorage.removeItem("localeats_auth_session");
      sessionStorage.clear();
    } catch {
      // Ignore cache clearing errors
    }
    window.location.reload();
  };

  handleCopyError = (): void => {
    if (this.state.error?.stack) {
      navigator.clipboard.writeText(this.state.error.stack);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-on-surface">
          <div className="w-full max-w-lg bg-surface-container rounded-2xl p-8 border border-outline-variant/20 shadow-xl flex flex-col items-center text-center">
            <div className="mb-6">
              <LocalEatsLogo size="md" />
            </div>

            <div className="w-14 h-14 rounded-2xl bg-error/10 text-error flex items-center justify-center mb-4">
              <AlertTriangle size={28} />
            </div>

            <h1 className="text-xl font-bold text-on-surface mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              The application encountered an unexpected runtime error. You can attempt to refresh the application or reset the local cache.
            </p>

            {this.state.error?.message && (
              <div className="w-full bg-surface-container-high/60 border border-outline-variant/10 rounded-xl p-3.5 mb-6 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Error Diagnostic
                  </span>
                  <button
                    onClick={this.handleCopyError}
                    className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1 transition-colors"
                  >
                    {this.state.copied ? (
                      <>
                        <Check size={12} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy trace</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs font-mono text-error break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 shadow hover:bg-primary-hover transition-colors"
              >
                <RefreshCw size={16} />
                <span>Reload App</span>
              </button>
              <button
                onClick={this.handleClearCacheAndReload}
                className="flex-1 py-3 px-4 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm flex items-center justify-center gap-2 border border-outline-variant/20 hover:bg-surface-container-highest transition-colors"
              >
                <Trash2 size={16} />
                <span>Clear Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
