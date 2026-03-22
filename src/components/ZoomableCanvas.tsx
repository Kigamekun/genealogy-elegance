import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

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

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.8;
const BUTTON_ZOOM_FACTOR = 1.16;
const WHEEL_ZOOM_INTENSITY = 0.0022;

function shouldIgnorePanTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return Boolean(element.closest("button, a, input, textarea, select, [role='button'], [data-no-pan='true']"));
}

export function ZoomableCanvas({ children }: ZoomableCanvasProps) {
  const [scalePercent, setScalePercent] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
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
  const needsScaleUpdateRef = useRef(false);

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
    };
  }, [applyTransform]);

  const clampScale = useCallback((scale: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)), []);

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

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    zoomAtClientPoint(transformRef.current.scale * factor, centerX, centerY);
  }, [zoomAtClientPoint]);

  const zoomIn = () => zoomByFactor(BUTTON_ZOOM_FACTOR);
  const zoomOut = () => zoomByFactor(1 / BUTTON_ZOOM_FACTOR);
  const resetView = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    scheduleRender(true);
  };

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
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
    <div className="relative w-full rounded-xl border border-border bg-card/30 overflow-hidden select-none" style={{ minHeight: "500px" }}>
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
        <button onClick={zoomIn} className="p-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-secondary transition-colors active:scale-95 shadow-sm">
          <ZoomIn className="w-4 h-4 text-foreground" />
        </button>
        <button onClick={zoomOut} className="p-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-secondary transition-colors active:scale-95 shadow-sm">
          <ZoomOut className="w-4 h-4 text-foreground" />
        </button>
        <button onClick={resetView} className="p-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border hover:bg-secondary transition-colors active:scale-95 shadow-sm">
          <Maximize2 className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-3 left-3 z-20 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm border border-border text-xs text-muted-foreground tabular-nums">
        {scalePercent}%
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden touch-none"
        style={{ minHeight: "500px", cursor: isDragging ? "grabbing" : "grab" }}
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
          <div className="flex justify-center py-8 px-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
