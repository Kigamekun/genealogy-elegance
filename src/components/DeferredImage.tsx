import { type ImgHTMLAttributes, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MAX_CONCURRENT_IMAGE_LOADS = 3;

type PendingImageLoad = {
  id: number;
  start: () => void;
};

let nextPendingImageLoadId = 1;
let activeImageLoads = 0;
const pendingImageLoads: PendingImageLoad[] = [];

function flushPendingImageLoads() {
  while (activeImageLoads < MAX_CONCURRENT_IMAGE_LOADS && pendingImageLoads.length > 0) {
    const nextLoad = pendingImageLoads.shift();
    if (!nextLoad) break;

    activeImageLoads += 1;
    nextLoad.start();
  }
}

function queueImageLoad(start: () => void) {
  const pendingLoad = {
    id: nextPendingImageLoadId,
    start,
  };
  nextPendingImageLoadId += 1;
  pendingImageLoads.push(pendingLoad);
  flushPendingImageLoads();

  return () => {
    const pendingIndex = pendingImageLoads.findIndex((entry) => entry.id === pendingLoad.id);
    if (pendingIndex >= 0) {
      pendingImageLoads.splice(pendingIndex, 1);
    }
  };
}

function releaseImageLoadSlot() {
  activeImageLoads = Math.max(0, activeImageLoads - 1);
  flushPendingImageLoads();
}

interface DeferredImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "children"> {
  src: string;
  alt: string;
  containerClassName?: string;
  imageClassName?: string;
  placeholder: ReactNode;
  eager?: boolean;
  background?: boolean;
  backgroundDelayMs?: number;
  rootMargin?: string;
}

export function DeferredImage({
  src,
  alt,
  containerClassName,
  imageClassName,
  placeholder,
  eager = false,
  background = true,
  backgroundDelayMs = 900,
  rootMargin = "280px",
  loading,
  decoding,
  fetchPriority,
  onLoad,
  onError,
  ...imgProps
}: DeferredImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slotHeldRef = useRef(false);
  const [isNearViewport, setIsNearViewport] = useState(eager);
  const [canLoadInBackground, setCanLoadInBackground] = useState(eager);
  const [shouldLoad, setShouldLoad] = useState(eager);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const releaseSlot = useCallback(() => {
    if (!slotHeldRef.current) return;
    slotHeldRef.current = false;
    releaseImageLoadSlot();
  }, []);

  useEffect(() => {
    setIsNearViewport(eager);
    setCanLoadInBackground(eager);
    setShouldLoad(eager);
    setHasLoaded(false);
    setHasFailed(false);
    releaseSlot();
  }, [eager, releaseSlot, src]);

  useEffect(() => {
    if (eager || isNearViewport || typeof window === "undefined") return;

    const container = containerRef.current;
    if (!container) return;

    if (!("IntersectionObserver" in window)) {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [eager, isNearViewport, rootMargin]);

  useEffect(() => {
    if (eager || isNearViewport || canLoadInBackground || !background || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCanLoadInBackground(true);
    }, backgroundDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [background, backgroundDelayMs, canLoadInBackground, eager, isNearViewport]);

  useEffect(() => {
    if ((!isNearViewport && !canLoadInBackground) || shouldLoad) return;

    let cancelled = false;
    const cancelQueuedLoad = queueImageLoad(() => {
      if (cancelled) {
        releaseImageLoadSlot();
        return;
      }

      slotHeldRef.current = true;
      setShouldLoad(true);
    });

    return () => {
      cancelled = true;
      cancelQueuedLoad();
      if (!hasLoaded && !hasFailed) {
        releaseSlot();
      }
    };
  }, [canLoadInBackground, hasFailed, hasLoaded, isNearViewport, releaseSlot, shouldLoad]);

  useEffect(() => () => {
    releaseSlot();
  }, [releaseSlot]);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", containerClassName)}>
      {placeholder}
      {shouldLoad && !hasFailed && (
        <img
          {...imgProps}
          src={src}
          alt={alt}
          loading={loading ?? "eager"}
          decoding={decoding ?? "async"}
          fetchPriority={fetchPriority ?? (eager || isNearViewport ? "high" : "low")}
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity duration-300",
            hasLoaded ? "opacity-100" : "opacity-0",
            imageClassName,
          )}
          onLoad={(event) => {
            setHasLoaded(true);
            releaseSlot();
            onLoad?.(event);
          }}
          onError={(event) => {
            setHasFailed(true);
            releaseSlot();
            onError?.(event);
          }}
        />
      )}
    </div>
  );
}
