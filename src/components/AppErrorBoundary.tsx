import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Safari Family crashed and was recovered by the app boundary.", error, errorInfo);
  }

  private handleReload = () => {
    if (typeof window !== "undefined") {
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
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Ada error tak terduga, tapi aplikasi tidak saya biarkan jatuh menjadi layar putih.
            Muat ulang halaman untuk masuk lagi ke pohon keluarga Anda.
          </p>
          <div className="mt-5 flex justify-center">
            <Button type="button" onClick={this.handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Muat Ulang
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
