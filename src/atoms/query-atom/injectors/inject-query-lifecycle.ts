import {
  injectEffect,
  injectRef,
  injectSignal,
  type Signal,
} from "@zedux/react";
import { GenericEventMap } from "@/atom-ecosystem/types";
import type {
  QueryAtomLifecycleHooks,
  TQueryDataSignal,
  TQueryDef,
} from "../_types";
import { queryLog } from "../_utils";

export const injectQueryLifecycle = <
  TQueryFnData,
  TFinalData,
  TError,
  TCombinedParams extends unknown[],
>(
  key: string,
  wasFetchStartedSignal: { get: () => boolean },
  queryDef: TQueryDef<TQueryFnData, TCombinedParams>,
  dataSignal: TQueryDataSignal<TFinalData>,
  errorSignal: { get: () => TError | undefined },
  queryStateSignal: { get: () => "error" | "success" | "idle" | "fetching" },
  {
    onQueryStarted,
    onCacheEntryAdded,
  }: {
    onQueryStarted?: (
      params: TCombinedParams,
      queryFulfilled: Promise<TQueryDataSignal<TFinalData>>,
    ) => Promise<void>;
    onCacheEntryAdded?: (
      params: TCombinedParams,
      cacheDataLoaded: Promise<TQueryDataSignal<TFinalData>>,
      cacheDataRemoved: Promise<void>,
    ) => Promise<void>;
  },
  debug: boolean,
) => {
  if (onQueryStarted) {
    injectEffect(() => {
      if (wasFetchStartedSignal.get()) {
        queryLog(debug, `Query ${key}: onQueryStarted effect running.`);
        onQueryStarted(queryDef.params, Promise.resolve(dataSignal));
      }
    }, [wasFetchStartedSignal.get()]);
  }

  if (onCacheEntryAdded) {
    injectEffect(() => {
      queryLog(debug, `Query ${key}: onCacheEntryAdded effect running.`);
      onCacheEntryAdded(
        queryDef.params,
        Promise.resolve(dataSignal),
        Promise.resolve(),
      );
    }, []);
  }
};

const injectCacheEntryAddedEffect = <
  TData,
  TError,
  TCombinedParams extends unknown[],
>(
  key: string,
  queryDef: TQueryDef<TData, TCombinedParams>,
  queryDataSignal: TQueryDataSignal<TData>,
  queryStateSignal: Signal<{
    Events: GenericEventMap;
    State: "error" | "success" | "idle" | "fetching";
  }>,

  hooks: QueryAtomLifecycleHooks<TData, TCombinedParams>,
  debug?: boolean,
) => {
  const cacheEntryAddedSignal = injectSignal(false);
  const cacheDataRemovedResolverRef = injectRef<(() => void) | null>(null);
  const cacheDataLoadedResolverRef = injectRef<
    ((value: TQueryDataSignal<TData>) => void) | null
  >(null);
  const cacheDataLoadedRejectorRef = injectRef<
    ((reason?: Error) => void) | null
  >(null);
  const currentState = queryStateSignal.get();
  injectEffect(() => {
    queryLog(
      debug,
      "queryState in effect for cacheEntryAdded",
      currentState,
      key,
    );

    if (currentState === "success") {
      queryLog(
        debug,
        "trying to resolve cacheDataLoaded with current resolver",
        key,
      );
      if (cacheDataLoadedResolverRef.current) {
        cacheDataLoadedResolverRef.current(queryDataSignal);
        // Null out the resolver and rejector after use, the promise is one-shot
        cacheDataLoadedResolverRef.current = null;
        cacheDataLoadedRejectorRef.current = null;
      }
    }
  }, [currentState]);

  injectEffect(() => {
    cacheEntryAddedSignal.set(true);
    if (hooks.onCacheEntryAdded) {
      const cacheDataLoadedPromise = new Promise<TQueryDataSignal<TData>>(
        (resolve, reject) => {
          queryLog(
            debug,
            "setting (resolver, rejector) for cacheDataLoaded",
            key,
          );
          cacheDataLoadedResolverRef.current = resolve;
          cacheDataLoadedRejectorRef.current = reject;
        },
      );
      const cacheDataRemovedPromise = new Promise<void>((resolve) => {
        queryLog(debug, "setting (resolver) for cacheDataRemovedPromise", key);
        cacheDataRemovedResolverRef.current = resolve;
      });
      hooks.onCacheEntryAdded?.(
        queryDef.params,
        cacheDataLoadedPromise,
        cacheDataRemovedPromise,
      );
    }
    return () => {
      cacheEntryAddedSignal.set(false);

      // If cacheDataLoaded promise hasn't resolved or rejected yet, reject it.
      if (cacheDataLoadedRejectorRef.current) {
        queryLog(
          debug,
          "Rejecting cacheDataLoaded as it was never resolved before removal",
          key,
        );
        cacheDataLoadedRejectorRef.current(
          new Error("Promise never resolved before cacheEntryRemoved."),
        );
      }

      cacheDataRemovedResolverRef.current?.();
      cacheDataRemovedResolverRef.current = null;
      cacheDataLoadedResolverRef.current = null;
      cacheDataLoadedRejectorRef.current = null;
    };
  }, []);
};
const injectQueryStartedEffect = <
  TData,
  TError,
  TCombinedParams extends unknown[],
>(
  key: string,
  wasFetchStartedSignal: Signal<{
    Events: GenericEventMap;
    State: boolean;
  }>,
  queryDef: TQueryDef<TData, TCombinedParams>, // Contains internal params
  queryDataSignal: TQueryDataSignal<TData>,
  errorSignal: Signal<{
    Events: GenericEventMap;
    State: TError | undefined;
  }>,
  queryStateSignal: Signal<{
    Events: GenericEventMap;
    State: "error" | "success" | "idle" | "fetching";
  }>,

  hooks: QueryAtomLifecycleHooks<TData, TCombinedParams>,
  debug?: boolean,
) => {
  // This ref will hold the resolver for the *current* active promise
  const currentQueryFulfilledResolverRef = injectRef<
    ((value: TQueryDataSignal<TData>) => void) | null
  >(null);
  const currentQueryFulfilledRejectorRef = injectRef<
    ((error: unknown) => void) | null
  >(null);
  const wasFetchStarted = wasFetchStartedSignal.get();

  const currentState = queryStateSignal.get();
  const currentError = errorSignal.get();
  injectEffect(() => {
    queryLog(debug, "queryState in effect", currentState, key);

    if (currentState === "success") {
      queryLog(debug, "trying to resolve with current resolver", key);
      currentQueryFulfilledResolverRef.current?.(queryDataSignal);
      // Null out the resolver after use, the promise is one-shot per trigger
      currentQueryFulfilledResolverRef.current = null;
      wasFetchStartedSignal.set(false);
    } else if (currentState === "error" && currentError) {
      queryLog(debug, "trying to reject with current rejector", key);
      currentQueryFulfilledRejectorRef.current?.(currentError);
      // Null out the rejector after use, the promise is one-shot per trigger
      currentQueryFulfilledRejectorRef.current = null;
      wasFetchStartedSignal.set(false);
    }
  }, [currentState, currentError]);

  injectEffect(() => {
    if (wasFetchStarted) {
      if (hooks.onQueryStarted) {
        // Create a new promise and its resolver each time the query is triggered
        const newQueryFulfilledPromise = new Promise<TQueryDataSignal<TData>>(
          (resolve, reject) => {
            queryLog(
              debug,
              "setting (resolver, rejector) for newQueryFulfilledPromise",
              key,
            );
            currentQueryFulfilledResolverRef.current = resolve;
            currentQueryFulfilledRejectorRef.current = reject;
          },
        );
        hooks.onQueryStarted(queryDef.params, newQueryFulfilledPromise);
      }
    } else {
      // If not triggered, or trigger is reset, null out the resolver
      currentQueryFulfilledResolverRef.current = null;
      currentQueryFulfilledRejectorRef.current = null;
      queryLog(debug, "resetting resolver for new promise", key);
    }
  }, [key, wasFetchStarted, queryDef]);
};
