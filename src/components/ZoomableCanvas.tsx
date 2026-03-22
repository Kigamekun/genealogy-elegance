import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

interface PointerPoint {
  x: number;
  y: number;
}

interface PinchState {
  startDistance: number;
  startScale: number;
  originContentX: number;
  originContentY: number;
}

interface TouchDragState {
  touchId: number | null;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  activated: boolean;
  startedOnInteractive: boolean;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.8;
const BUTTON_ZOOM_FACTOR = 1.16;
const WHEEL_ZOOM_INTENSITY = 0.0022;
const FIT_PADDING_DESKTOP = 28;
const FIT_PADDING_MOBILE = 14;
const TOUCH_DRAG_THRESHOLD = 6;

function shouldIgnorePanTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return Boolean(element.closest("button, a, input, textarea, select, [role='button'], [data-no-pan='true']"));
}

export function ZoomableCanvas({ children }: ZoomableCanvasProps) {
  const [scalePercent, setScalePercent] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
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
  const touchDragRef = useRef<TouchDragState>({
    touchId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    activated: false,
    startedOnInteractive: false,
  });
  const pinchRef = useRef<PinchState | null>(null);
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

  const getPinchMetricsFromPoints = useCallback((first: PointerPoint, second: PointerPoint) => {
    const dx = second.x - first.x;
    const dy = second.y - first.y;

    return {
      distance: Math.max(Math.hypot(dx, dy), 1),
      midpointX: (first.x + second.x) / 2,
      midpointY: (first.y + second.y) / 2,
    };
  }, []);

  const beginPinch = useCallback((first: PointerPoint, second: PointerPoint) => {
    const container = containerRef.current;
    const metrics = getPinchMetricsFromPoints(first, second);
    if (!container || !metrics) return;

    const rect = container.getBoundingClientRect();
    const viewportX = metrics.midpointX - rect.left;
    const viewportY = metrics.midpointY - rect.top;
    const current = transformRef.current;

    pinchRef.current = {
      startDistance: metrics.distance,
      startScale: current.scale,
      originContentX: (viewportX - current.x) / current.scale,
      originContentY: (viewportY - current.y) / current.scale,
    };

    dragRef.current.pointerId = null;
    touchDragRef.current.touchId = null;
    setIsDragging(false);
  }, [getPinchMetricsFromPoints]);

  const updatePinch = useCallback((first: PointerPoint, second: PointerPoint) => {
    const container = containerRef.current;
    const pinch = pinchRef.current;
    const metrics = getPinchMetricsFromPoints(first, second);
    if (!container || !pinch || !metrics) return;

    const rect = container.getBoundingClientRect();
    const viewportX = metrics.midpointX - rect.left;
    const viewportY = metrics.midpointY - rect.top;
    const nextScale = clampScale(pinch.startScale * (metrics.distance / pinch.startDistance));

    transformRef.current = {
      scale: nextScale,
      x: viewportX - pinch.originContentX * nextScale,
      y: viewportY - pinch.originContentY * nextScale,
    };

    scheduleRender(true);
  }, [clampScale, getPinchMetricsFromPoints, scheduleRender]);

  const beginTouchDrag = useCallback((touch: Touch, target: EventTarget | null, startedOnInteractive?: boolean) => {
    touchDragRef.current = {
      touchId: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
      activated: false,
      startedOnInteractive: startedOnInteractive ?? shouldIgnorePanTarget(target),
    };
  }, []);

  const clearTouchDrag = useCallback(() => {
    const hadTouchDrag = touchDragRef.current.touchId !== null || touchDragRef.current.activated || touchDragRef.current.startedOnInteractive;
    touchDragRef.current = {
      touchId: null,
      startX: 0,
      startY: 0,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
      activated: false,
      startedOnInteractive: false,
    };
    if (hadTouchDrag) setIsDragging(false);
  }, []);

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
  const isImmersive = isFallbackFullscreen;

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;

    if (document.fullscreenElement === wrapperRef.current) {
      await document.exitFullscreen();
    }

    if (isFallbackFullscreen) {
      setIsFallbackFullscreen(false);
      return;
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
    if (e.pointerType === "touch") return;
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
    if (e.pointerType === "touch") return;

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

  const finishPointer = useCallback((pointerId: number, currentTarget: HTMLDivElement) => {
    stopDragging(pointerId, currentTarget);
    if (currentTarget.hasPointerCapture(pointerId)) currentTarget.releasePointerCapture(pointerId);
  }, [stopDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    finishPointer(e.pointerId, e.currentTarget);
  }, [finishPointer]);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    finishPointer(e.pointerId, e.currentTarget);
  }, [finishPointer]);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    if (dragRef.current.pointerId === e.pointerId && e.currentTarget.hasPointerCapture(e.pointerId)) {
      return;
    }
    finishPointer(e.pointerId, e.currentTarget);
  }, [finishPointer]);

  const handleNativeTouchStart = useCallback((event: TouchEvent) => {
    const touches = Array.from(event.touches);

    if (touches.length >= 2) {
      userInteractedRef.current = true;
      event.preventDefault();
      beginPinch(
        { x: touches[0].clientX, y: touches[0].clientY },
        { x: touches[1].clientX, y: touches[1].clientY },
      );
      updatePinch(
        { x: touches[0].clientX, y: touches[0].clientY },
        { x: touches[1].clientX, y: touches[1].clientY },
      );
      clearTouchDrag();
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) return;
    beginTouchDrag(touch, event.target);
  }, [beginPinch, beginTouchDrag, clearTouchDrag, updatePinch]);

  const handleNativeTouchMove = useCallback((event: TouchEvent) => {
    const touches = Array.from(event.touches);

    if (touches.length >= 2) {
      if (!pinchRef.current) {
        beginPinch(
          { x: touches[0].clientX, y: touches[0].clientY },
          { x: touches[1].clientX, y: touches[1].clientY },
        );
      }

      userInteractedRef.current = true;
      event.preventDefault();
      updatePinch(
        { x: touches[0].clientX, y: touches[0].clientY },
        { x: touches[1].clientX, y: touches[1].clientY },
      );
      clearTouchDrag();
      return;
    }

    const drag = touchDragRef.current;
    if (drag.touchId === null) return;

    const touch = touches.find((item) => item.identifier === drag.touchId);
    if (!touch) return;

    const dx = touch.clientX - drag.startX;
    const dy = touch.clientY - drag.startY;

    if (!drag.activated) {
      if (Math.abs(dx) < TOUCH_DRAG_THRESHOLD && Math.abs(dy) < TOUCH_DRAG_THRESHOLD) return;
      if (drag.startedOnInteractive) return;
      drag.activated = true;
      setIsDragging(true);
    }

    userInteractedRef.current = true;
    event.preventDefault();
    transformRef.current = {
      ...transformRef.current,
      x: drag.originX + dx,
      y: drag.originY + dy,
    };
    scheduleRender(false);
  }, [beginPinch, clearTouchDrag, scheduleRender, updatePinch]);

  const handleNativeTouchEnd = useCallback((event: TouchEvent) => {
    const remainingTouches = Array.from(event.touches);

    if (remainingTouches.length >= 2) {
      beginPinch(
        { x: remainingTouches[0].clientX, y: remainingTouches[0].clientY },
        { x: remainingTouches[1].clientX, y: remainingTouches[1].clientY },
      );
      updatePinch(
        { x: remainingTouches[0].clientX, y: remainingTouches[0].clientY },
        { x: remainingTouches[1].clientX, y: remainingTouches[1].clientY },
      );
      return;
    }

    pinchRef.current = null;

    if (remainingTouches.length === 1) {
      beginTouchDrag(remainingTouches[0], remainingTouches[0].target, false);
      setIsDragging(false);
      return;
    }

    clearTouchDrag();
  }, [beginPinch, beginTouchDrag, clearTouchDrag, updatePinch]);

  const handleNativeTouchCancel = useCallback(() => {
    pinchRef.current = null;
    clearTouchDrag();
  }, [clearTouchDrag]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const options: AddEventListenerOptions = { passive: false };
    container.addEventListener("touchstart", handleNativeTouchStart, options);
    container.addEventListener("touchmove", handleNativeTouchMove, options);
    container.addEventListener("touchend", handleNativeTouchEnd, options);
    container.addEventListener("touchcancel", handleNativeTouchCancel, options);

    return () => {
      container.removeEventListener("touchstart", handleNativeTouchStart, options);
      container.removeEventListener("touchmove", handleNativeTouchMove, options);
      container.removeEventListener("touchend", handleNativeTouchEnd, options);
      container.removeEventListener("touchcancel", handleNativeTouchCancel, options);
    };
  }, [handleNativeTouchCancel, handleNativeTouchEnd, handleNativeTouchMove, handleNativeTouchStart]);

  const canvas = (
    <div
      ref={wrapperRef}
      className={cn(
        "relative w-full overflow-hidden select-none border border-border bg-card/30 transition-[height,border-radius,background-color] duration-300",
        isImmersive
          ? "fixed inset-0 z-[80] rounded-none border-0 bg-background"
          : "rounded-[28px]",
      )}
      style={{
        height: isImmersive ? "100svh" : "min(100dvh - 12rem, 920px)",
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
        style={{
          minHeight: "100%",
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
          overscrollBehavior: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
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

  if (isFallbackFullscreen && typeof document !== "undefined") {
    return createPortal(canvas, document.body);
  }

  return canvas;
}
