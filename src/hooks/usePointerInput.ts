import { useEffect, useRef } from 'react';

export function usePointerInput(handCursorRef: React.RefObject<{ x: number; y: number; isPinching: boolean; lastSeen?: number }>) {
  const pointerRef = useRef({ x: 0.5, y: 0.5, isDown: false, lastMouseActivity: Date.now() });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      pointerRef.current.x = e.clientX / window.innerWidth;
      pointerRef.current.y = e.clientY / window.innerHeight;
      pointerRef.current.lastMouseActivity = Date.now();
    };
    const handleMouseDown = (e: MouseEvent) => {
      pointerRef.current.x = e.clientX / window.innerWidth;
      pointerRef.current.y = e.clientY / window.innerHeight;
      pointerRef.current.isDown = true;
      pointerRef.current.lastMouseActivity = Date.now();
    };
    const handleMouseUp = () => {
      pointerRef.current.isDown = false;
      pointerRef.current.lastMouseActivity = Date.now();
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        pointerRef.current.x = e.touches[0].clientX / window.innerWidth;
        pointerRef.current.y = e.touches[0].clientY / window.innerHeight;
        pointerRef.current.lastMouseActivity = Date.now();
      }
    };
    const handleTouchStart = (e: TouchEvent) => {
      pointerRef.current.isDown = true;
      handleTouchMove(e);
    };
    const handleTouchEnd = () => {
      pointerRef.current.isDown = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const getPointer = () => {
    const hand = handCursorRef.current;
    const now = performance.now();
    
    // Hand tracking active if valid coordinates and updated recently (< 200ms)
    if (hand && hand.x >= 0 && hand.y >= 0 && hand.lastSeen && (now - hand.lastSeen < 200)) {
      return { 
        x: hand.x, 
        y: hand.y, 
        active: hand.isPinching || pointerRef.current.isDown 
      };
    }

    // Default to mouse / touch coordinates
    return { 
      x: pointerRef.current.x, 
      y: pointerRef.current.y, 
      active: pointerRef.current.isDown 
    };
  };

  return getPointer;
}
