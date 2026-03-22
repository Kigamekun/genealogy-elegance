import { createRoot } from "react-dom/client";
import { act, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderBoundary(child: ReactNode) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<AppErrorBoundary>{child}</AppErrorBoundary>);
  });

  return () => {
    act(() => root.unmount());
    container.remove();
  };
}

function CrashOnRender() {
  throw new Error("boundary test");
}

describe("AppErrorBoundary", () => {
  it("shows a recovery screen instead of a white page", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const cleanup = renderBoundary(<CrashOnRender />);
      try {
        expect(document.body.textContent).toContain("Halaman berhasil diamankan");
        expect(document.body.textContent).toContain("Ada error tak terduga, silakan muat ulang aja.");
        expect(document.body.textContent).toContain("Hard Refresh Bersih");
      } finally {
        cleanup();
      }
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
