import { useEffect, useRef, useState } from "react";

/** A 35% rubber-band response, capped so the list never flies off screen. */
export function merchantPullDistance(fingerDistance: number): number {
  return Math.min(64, Math.max(0, fingerDistance) * 0.35);
}

/**
 * Touch-only gesture. It activates solely at document scroll-top, away from
 * interactive controls, order cards, and horizontal/vertical nested scrollers.
 * Existing browser scrolling is untouched unless a vertical pull qualifies.
 */
export function useMerchantPullToRefresh(
  enabled: boolean,
  onRefresh: () => void | Promise<void>,
) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const callback = useRef(onRefresh);
  callback.current = onRefresh;
  const [pulling, setPulling] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !enabled) return;
    let startY = 0;
    let startX = 0;
    let eligible = false;
    let dragging = false;
    let ready = false;

    const reset = () => {
      if (dragging) {
        surface.style.transition = "";
        surface.style.transform = "";
      }
      dragging = false;
      eligible = false;
      ready = false;
      setArmed(false);
      setPulling(false);
    };
    const start = (event: TouchEvent) => {
      reset();
      if (event.touches.length !== 1 || window.scrollY > 1 ||
          (document.scrollingElement?.scrollTop ?? 0) > 1) return;
      const target = event.target;
      if (!(target instanceof Element) ||
          target.closest('button, a, input, textarea, select, [role="button"], [role="dialog"], [draggable="true"], .overflow-x-auto, .overflow-y-auto')) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      eligible = true;
    };
    const move = (event: TouchEvent) => {
      if (!eligible || event.touches.length !== 1) return;
      const deltaY = event.touches[0].clientY - startY;
      const deltaX = event.touches[0].clientX - startX;
      if (!dragging && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        eligible = false;
        return;
      }
      if (deltaY <= 8 || (window.scrollY > 1 && !dragging)) return;
      if (!dragging) {
        dragging = true;
        surface.style.transition = "none";
        setPulling(true);
      }
      // Prevent native pull-to-refresh only after recognising our own gesture.
      if (event.cancelable) event.preventDefault();
      const distance = merchantPullDistance(deltaY);
      surface.style.transform = `translate3d(0, ${distance}px, 0)`;
      const nextReady = distance >= 52;
      if (ready !== nextReady) {
        ready = nextReady;
        setArmed(nextReady);
      }
    };
    const end = () => {
      const trigger = dragging && ready;
      reset();
      if (trigger) void callback.current();
    };

    surface.addEventListener("touchstart", start, { passive: true });
    surface.addEventListener("touchmove", move, { passive: false });
    surface.addEventListener("touchend", end);
    surface.addEventListener("touchcancel", reset);
    return () => {
      surface.removeEventListener("touchstart", start);
      surface.removeEventListener("touchmove", move);
      surface.removeEventListener("touchend", end);
      surface.removeEventListener("touchcancel", reset);
      surface.style.transition = "";
      surface.style.transform = "";
    };
  }, [enabled]);

  return { surfaceRef, pulling, armed };
}
