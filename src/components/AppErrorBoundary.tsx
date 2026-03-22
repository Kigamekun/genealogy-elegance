import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { clearFamilyTreeBrowserCache } from "@/lib/family-storage";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  isReloading: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    isReloading: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Safari Family crashed and was recovered by the app boundary.", error, errorInfo);
  }

  private handleReload = async () => {
    if (typeof window === "undefined" || this.state.isReloading) {
      return;
    }

    this.setState({ isReloading: true });

    try {
      await clearFamilyTreeBrowserCache();

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("_recovery", Date.now().toString());
      nextUrl.searchParams.set("_hard", "1");
      window.location.assign(nextUrl.toString());
    } catch (error) {
      console.error("Safari Family failed to clear local browser data during recovery.", error);
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="glass-card w-full max-w-xl rounded-[32px] border border-border/70 px-6 py-7 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl leading-tight text-foreground">Halaman berhasil diamankan</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Ada error tak terduga, silakan muat ulang aja.</p>
          <div className="mt-5 flex justify-center">
            <Button type="button" onClick={() => void this.handleReload()} className="gap-2" disabled={this.state.isReloading}>
              <RefreshCw className="h-4 w-4" />
              {this.state.isReloading ? "Hard Refresh..." : "Hard Refresh Bersih"}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
