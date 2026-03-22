import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZoomableCanvasProps {
  children: ReactNode;
}

interface TransformState {
  x: number;
  y: number;
  scale: number;
}

interface DragState {
  pointerId: number | null;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.8;
const BUTTON_ZOOM_FACTOR = 1.16;
const WHEEL_ZOOM_INTENSITY = 0.0022;
const FIT_PADDING_DESKTOP = 28;
const FIT_PADDING_MOBILE = 14;

function shouldIgnorePanTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return Boolean(element.closest("button, a, input, textarea, select, [role='button'], [data-no-pan='true']"));
}

export function ZoomableCanvas({ children }: ZoomableCanvasProps) {
  const [scalePercent, setScalePercent] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<TransformState>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<DragState>({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const frameRef = useRef<number | null>(null);
  const fitFrameRef = useRef<number | null>(null);
  const needsScaleUpdateRef = useRef(false);
  const userInteractedRef = useRef(false);

  const applyTransform = useCallback(() => {
    if (!contentRef.current) return;
    const { x, y, scale } = transformRef.current;
    contentRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);

  const scheduleRender = useCallback((updateScale = false) => {
    needsScaleUpdateRef.current = needsScaleUpdateRef.current || updateScale;
    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      applyTransform();

      if (needsScaleUpdateRef.current) {
        setScalePercent(Math.round(transformRef.current.scale * 100));
        needsScaleUpdateRef.current = false;
      }
    });
  }, [applyTransform]);

  useEffect(() => {
    applyTransform();
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      if (fitFrameRef.current !== null) window.cancelAnimationFrame(fitFrameRef.current);
    };
  }, [applyTransform]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const syncFullscreenState = () => {
      setIsNativeFullscreen(document.fullscreenElement === wrapperRef.current);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    syncFullscreenState();

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!isFallbackFullscreen || typeof document === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFallbackFullscreen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFallbackFullscreen]);

  const clampScale = useCallback((scale: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)), []);

  const fitToView = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;
    const fitPadding = isMobileViewport ? FIT_PADDING_MOBILE : FIT_PADDING_DESKTOP;
    const contentWidth = Math.max(content.scrollWidth, 1);
    const contentHeight = Math.max(content.scrollHeight, 1);
    const availableWidth = Math.max(container.clientWidth - fitPadding * 2, 1);
    const availableHeight = Math.max(container.clientHeight - fitPadding * 2, 1);
    const nextScale = clampScale(Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1));

    transformRef.current = {
      scale: nextScale,
      x: Math.round((container.clientWidth - contentWidth * nextScale) / 2),
      y: Math.round((container.clientHeight - contentHeight * nextScale) / 2),
    };
    scheduleRender(true);
  }, [clampScale, scheduleRender]);

  const scheduleFitToView = useCallback(() => {
    if (fitFrameRef.current !== null) window.cancelAnimationFrame(fitFrameRef.current);
    fitFrameRef.current = window.requestAnimationFrame(() => {
      fitFrameRef.current = null;
      fitToView();
    });
  }, [fitToView]);

  const zoomAtClientPoint = useCallback((nextScale: number, clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;

    const clampedScale = clampScale(nextScale);
    const rect = container.getBoundingClientRect();
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;
    const current = transformRef.current;

    const contentX = (viewportX - current.x) / current.scale;
    const contentY = (viewportY - current.y) / current.scale;

    transformRef.current = {
      scale: clampedScale,
      x: viewportX - contentX * clampedScale,
      y: viewportY - contentY * clampedScale,
    };

    scheduleRender(true);
  }, [clampScale, scheduleRender]);

  const zoomByFactor = useCallback((factor: number) => {
    const container = containerRef.current;
    if (!container) return;

    userInteractedRef.current = true;
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    zoomAtClientPoint(transformRef.current.scale * factor, centerX, centerY);
  }, [zoomAtClientPoint]);

  const zoomIn = () => zoomByFactor(BUTTON_ZOOM_FACTOR);
  const zoomOut = () => zoomByFactor(1 / BUTTON_ZOOM_FACTOR);
  const resetView = () => {
    userInteractedRef.current = false;
    scheduleFitToView();
  };
  const isImmersive = isNativeFullscreen || isFallbackFullscreen;

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;

    if (isFallbackFullscreen) {
      setIsFallbackFullscreen(false);
      return;
    }

    if (document.fullscreenElement === wrapperRef.current) {
      await document.exitFullscreen();
      return;
    }

    const prefersFallbackFullscreen = window.matchMedia("(max-width: 767px)").matches;
    if (prefersFallbackFullscreen) {
      userInteractedRef.current = false;
      setIsFallbackFullscreen(true);
      return;
    }

    const wrapper = wrapperRef.current;
    if (wrapper?.requestFullscreen) {
      try {
        userInteractedRef.current = false;
        await wrapper.requestFullscreen();
        return;
      } catch {
        // Fall back to a fixed immersive layout for browsers that reject fullscreen.
      }
    }

    userInteractedRef.current = false;
    setIsFallbackFullscreen(true);
  }, [isFallbackFullscreen]);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return undefined;

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          if (!userInteractedRef.current || isImmersive) {
            scheduleFitToView();
          }
        })
      : null;

    observer?.observe(container);
    observer?.observe(content);
    scheduleFitToView();

    return () => {
      observer?.disconnect();
    };
  }, [isImmersive, scheduleFitToView]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    userInteractedRef.current = true;
    const zoomFactor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.005 : WHEEL_ZOOM_INTENSITY));
    const nextScale = clampScale(transformRef.current.scale * zoomFactor);
    if (Math.abs(nextScale - transformRef.current.scale) < 0.0001) return;

    zoomAtClientPoint(nextScale, e.clientX, e.clientY);
  }, [clampScale, zoomAtClientPoint]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 0 && shouldIgnorePanTarget(e.target)) return;

    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    container.setPointerCapture(e.pointerId);
    userInteractedRef.current = true;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
    };
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    transformRef.current = {
      ...transformRef.current,
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    };
    scheduleRender(false);
  }, [scheduleRender]);

  const stopDragging = useCallback((pointerId: number, currentTarget: HTMLDivElement) => {
    if (dragRef.current.pointerId !== pointerId) return;
    if (currentTarget.hasPointerCapture(pointerId)) currentTarget.releasePointerCapture(pointerId);
    dragRef.current.pointerId = null;
    setIsDragging(false);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    stopDragging(e.pointerId, e.currentTarget);
  }, [stopDragging]);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    stopDragging(e.pointerId, e.currentTarget);
  }, [stopDragging]);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId === e.pointerId && e.currentTarget.hasPointerCapture(e.pointerId)) {
      return;
    }
    stopDragging(e.pointerId, e.currentTarget);
  }, [stopDragging]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative w-full overflow-hidden select-none border border-border bg-card/30 transition-[height,border-radius,background-color] duration-300",
        isImmersive
          ? "fixed inset-0 z-[80] rounded-none border-0 bg-background"
          : "rounded-[28px]",
      )}
      style={{
        height: isImmersive ? "100dvh" : "min(100dvh - 12rem, 920px)",
        minHeight: isImmersive ? "100dvh" : "clamp(460px, 72dvh, 920px)",
      }}
    >
      {/* Zoom controls */}
      <div
        className="absolute z-20 flex flex-col gap-1.5 sm:top-4 sm:right-4"
        style={{
          top: isImmersive ? "calc(env(safe-area-inset-top) + 12px)" : "12px",
          right: isImmersive ? "calc(env(safe-area-inset-right) + 12px)" : "12px",
        }}
      >
        <button onClick={zoomIn} title="Perbesar" className="p-2.5 rounded-2xl bg-background/88 backdrop-blur-sm border border-border hover:bg-secondary transition-colors active:scale-95 shadow-sm">
          <ZoomIn className="w-4 h-4 text-foreground" />
        </button>
        <button onClick={zoomOut} title="Perkecil" className="p-2.5 rounded-2xl bg-background/88 backdrop-blur-sm border border-border hover:bg-secondary transition-colors active:scale-95 shadow-sm">
          <ZoomOut className="w-4 h-4 text-foreground" />
        </button>
        <button onClick={resetView} title="Reset tampilan" className="p-2.5 rounded-2xl bg-background/88 backdrop-blur-sm border border-border hover:bg-secondary transition-colors active:scale-95 shadow-sm">
          <RotateCcw className="w-4 h-4 text-foreground" />
        </button>
        <button onClick={() => { void toggleFullscreen(); }} title={isImmersive ? "Keluar fullscreen" : "Masuk fullscreen"} className="p-2.5 rounded-2xl bg-background/88 backdrop-blur-sm border border-border hover:bg-secondary transition-colors active:scale-95 shadow-sm">
          {isImmersive ? <Minimize2 className="w-4 h-4 text-foreground" /> : <Maximize2 className="w-4 h-4 text-foreground" />}
        </button>
      </div>

      {/* Scale indicator */}
      <div
        className="absolute z-20 px-2.5 py-1 rounded-full bg-background/88 backdrop-blur-sm border border-border text-xs text-muted-foreground tabular-nums"
        style={{
          bottom: isImmersive ? "calc(env(safe-area-inset-bottom) + 12px)" : "12px",
          left: isImmersive ? "calc(env(safe-area-inset-left) + 12px)" : "12px",
        }}
      >
        {scalePercent}%
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden touch-none"
        style={{ minHeight: "100%", cursor: isDragging ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 will-change-transform"
          style={{
            transformOrigin: "0 0",
            width: "max-content",
            minWidth: "100%",
            height: "max-content",
            minHeight: "100%",
          }}
        >
          <div className="flex justify-center px-4 py-5 sm:px-6 sm:py-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
