import { useEffect, useRef } from 'react';

export function usePointerInput(handCursorRef: React.RefObject<{ x: number, y: number, isPinching: boolean }>) {
  const pointerRef = useRef({ x: 0.5, y: 0.5, isDown: false });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Only use mouse if hand isn't active (we can guess if hand isn't active if hand wasn't updated recently, but for now just let mouse override if moved)
      pointerRef.current.x = e.clientX / window.innerWidth;
      pointerRef.current.y = e.clientY / window.innerHeight;
    };
    const handleMouseDown = () => pointerRef.current.isDown = true;
    const handleMouseUp = () => pointerRef.current.isDown = false;
    const handleTouchMove = (e: TouchEvent) => {
      if(e.touches.length > 0) {
        pointerRef.current.x = e.touches[0].clientX / window.innerWidth;
        pointerRef.current.y = e.touches[0].clientY / window.innerHeight;
      }
    }
    const handleTouchStart = (e: TouchEvent) => {
      pointerRef.current.isDown = true;
      handleTouchMove(e);
    }
    const handleTouchEnd = () => pointerRef.current.isDown = false;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

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
    // Combine mouse and hand. Hand takes priority if it's "pinching" or "active", but to be simple, if hand is present we use it.
    // We'll just define that the 3D scene polls this `getPointer` every frame.
    const hand = handCursorRef.current;
    if (hand && (hand.x !== 0 || hand.y !== 0)) {
      // If hand is detected, use hand
      return { x: hand.x, y: hand.y, active: hand.isPinching };
    }
    return { x: pointerRef.current.x, y: pointerRef.current.y, active: pointerRef.current.isDown };
  };

  return getPointer;
}
