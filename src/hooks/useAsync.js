// Async-read helpers for the API migration.
//
// The app's data modules were synchronous (localStorage). Their API
// replacements are async, so a component that used to read at render now needs
// loading/error state. `useAsync` standardizes that, and re-runs when any of the
// listed `events` fire on window (the app already drives cross-component refresh
// through window events like "leadDataChanged", "designFlowChanged").

import { useCallback, useEffect, useRef, useState } from "react";

export function useAsync(fn, deps = [], { events = [], enabled = true } = {}) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    let alive = true;
    const guarded = async () => {
      if (!alive) return;
      await run();
    };
    guarded();
    const handlers = events.map((evt) => {
      const h = () => run();
      window.addEventListener(evt, h);
      return [evt, h];
    });
    return () => {
      alive = false;
      handlers.forEach(([evt, h]) => window.removeEventListener(evt, h));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return { data, error, loading, reload: run, setData };
}
