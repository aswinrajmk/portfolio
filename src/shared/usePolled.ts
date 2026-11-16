import { useEffect, useState } from "react";

// Loads data, then keeps reloading while `nextDelay` returns a number of milliseconds.
// Skips network calls while the tab is hidden and refreshes as soon as it becomes visible again.
// Pass stable functions (module-level), otherwise polling restarts on every render.
export function usePolled<T>(load: () => Promise<T>, nextDelay: (data: T) => number | null): T | undefined {
  const [data, setData] = useState<T>();

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latest: T | undefined;

    async function tick() {
      if (document.hidden) {
        timer = setTimeout(tick, 1000);
        return;
      }
      const result = await load();
      if (!active) return;
      latest = result;
      setData(result);
      const delay = nextDelay(result);
      if (delay !== null) timer = setTimeout(tick, delay);
    }

    function onVisible() {
      if (!document.hidden && latest !== undefined && nextDelay(latest) === null) {
        clearTimeout(timer);
        void tick();
      }
    }

    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, nextDelay]);

  return data;
}
