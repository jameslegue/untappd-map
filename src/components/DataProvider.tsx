"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Checkin, Mode, Payload } from "@/lib/types";

type Ctx = {
  mode: Mode;
  checkins: Checkin[];
  loading: boolean;
  reload: () => Promise<void>;
};

const DataCtx = createContext<Ctx>({ mode: "public", checkins: [], loading: true, reload: async () => {} });

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ mode: Mode; checkins: Checkin[]; loading: boolean }>({
    mode: "public",
    checkins: [],
    loading: true,
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    // Private first; the server answers 401 when locked
    let res = await fetch("/api/private", { cache: "no-store" });
    if (res.status === 401) res = await fetch("/api/public");
    const body = (await res.json()) as Payload;
    setState({ mode: body.mode, checkins: body.checkins ?? [], loading: false });
  }, []);

  useEffect(() => {
    reload().catch(() => setState((s) => ({ ...s, loading: false })));
  }, [reload]);

  return <DataCtx.Provider value={{ ...state, reload }}>{children}</DataCtx.Provider>;
}

export const useData = () => useContext(DataCtx);
