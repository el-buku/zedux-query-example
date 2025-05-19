import { api, atom, injectSignal } from "@zedux/react";
import type { CachedQueryEntry } from "./_types";

export const crossParamCacheAtom = atom(
  "crossParamCache",
  <TData, TParams extends unknown[]>(_id: string, ttl: number) => {
    const cacheSignal = injectSignal(
      new Map<string, CachedQueryEntry<TData, TParams> | null>(),
    );
    return api(cacheSignal)
      .setTtl(ttl)
      .setExports({
        getCache: (cacheKey: string) => cacheSignal.get().get(cacheKey),
        setCache: (
          cacheKey: string,
          cacheEntry: CachedQueryEntry<TData, TParams> | null,
        ) =>
          cacheSignal.set((oldMap) => {
            const newMap = new Map(oldMap);
            newMap.set(cacheKey, cacheEntry);
            return newMap;
          }),
      });
  },
);
