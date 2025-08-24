// useLiveFPS.js
import { useState, useEffect, useRef } from 'react';

const useLiveFPS = () => {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    let rafId;

    const loop = (now) => {
      frameCount.current += 1;
      const delta = now - lastTime.current;

      if (delta >= 1000) {
        setFps((frameCount.current * 1000) / delta);
        frameCount.current = 0;
        lastTime.current = now;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return fps.toFixed(1);
};

export default useLiveFPS;
