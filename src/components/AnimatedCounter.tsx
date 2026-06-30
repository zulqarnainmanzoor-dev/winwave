import { useState, useEffect } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export default function AnimatedCounter({
  value,
  duration = 800,
  prefix = "",
  suffix = "",
  decimals = 2
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Calculate current value using an ease-out-quad function for professional smoothness
      const easeOutQuad = (t: number) => t * (2 - t);
      const easeProgress = easeOutQuad(progress);
      
      setCount(easeProgress * value);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCount(value);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  const formatted = count.toLocaleString(undefined, {
    minimumFractionDigits: decimals === 0 ? 0 : decimals,
    maximumFractionDigits: decimals
  });

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
