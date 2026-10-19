import { useEffect, useState } from "react";

/** 실행 중일 때만 1초마다 다시 그려 경과 시간을 올린다. */
export function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
