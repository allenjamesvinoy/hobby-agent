import { useEffect, useRef, useState } from 'react';
import { api } from '../services/apiClient';

export function useReviewPoints(queryId, userId, fileId, enabled) {
  const [points, setPoints] = useState(null);
  const context = useRef({ queryId, userId });
  const target = useRef(null);
  const responseVersion = useRef(0);
  const triggerPulse = useRef(null);
  context.current = { queryId, userId };
  target.current = enabled ? fileId : null;
  useEffect(() => {
    let disposed = false, inFlight = false, pulseQueued = false;
    let lastInteraction = Date.now();
    setPoints(null);
    const touch = () => { lastInteraction = Date.now(); };
    const tick = async () => {
      if (disposed) return;
      if (inFlight) { pulseQueued = true; return; }
      inFlight = true;
      const version = ++responseVersion.current;
      const active = document.visibilityState === 'visible' && document.hasFocus() && Date.now() - lastInteraction < 60000;
      try {
        const data = await api.reviewPoints(queryId, userId, { fileId: active ? target.current : null });
        if (!disposed && version === responseVersion.current) setPoints(data);
      } catch (_) { /* Points never interrupt review with connection banners. */ }
      finally {
        inFlight = false;
        if (pulseQueued && !disposed) { pulseQueued = false; tick(); }
      }
    };
    triggerPulse.current = tick;
    const wake = () => { touch(); tick(); };
    for (const event of ['pointerdown', 'keydown', 'scroll']) window.addEventListener(event, touch, { passive: true, capture: true });
    window.addEventListener('focus', wake);
    window.addEventListener('blur', tick);
    document.addEventListener('visibilitychange', tick);
    tick();
    const timer = setInterval(tick, 2000);
    return () => {
      disposed = true;
      if (triggerPulse.current === tick) triggerPulse.current = null;
      clearInterval(timer);
      for (const event of ['pointerdown', 'keydown', 'scroll']) window.removeEventListener(event, touch, true);
      window.removeEventListener('focus', wake);
      window.removeEventListener('blur', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [queryId, userId]);
  useEffect(() => { triggerPulse.current?.(); }, [fileId, enabled]);
  const acceptPoints = (data, query, reviewer) => {
    if (data && context.current.queryId === query && context.current.userId === reviewer) { responseVersion.current++; setPoints(data); }
  };
  return { points, acceptPoints };
}
