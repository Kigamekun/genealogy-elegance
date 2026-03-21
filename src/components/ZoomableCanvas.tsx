import { useRef, useState, useCallback, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface ZoomableCanvasProps {
  children: ReactNode;
}

export function ZoomableCanvas({ children }: ZoomableCanvasProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomIn = () => setScale((s) => Math.min(s + 0.15, 2));
  const zoomOut = () => setScale((s) => Math.max(s - 0.15, 0.4));
  const resetView = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale((s) => Math.max(0.4, Math.min(2, s + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    }
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => setIsDragging(false), []);

  return (
    <div className="relative w-full rounded-xl border border-border bg-card/30 overflow-hidden" style={{ minHeight: "500px" }}>
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
        {Math.round(scale * 100)}%
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden"
        style={{ minHeight: "500px", cursor: isDragging ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="inline-flex justify-center w-full py-8 transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center top",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
