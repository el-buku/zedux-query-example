import {
  type Ecosystem,
  injectAtomValue,
  injectEcosystem,
  injectEffect,
  type MappedSignal,
  type MutableRefObject,
  type PromiseState,
  type Signal,
} from "@zedux/react";
import { GenericEventMap } from "@/atom-ecosystem/types";
import type { PromiseMeta, QueryAtomOptions, TQueryControl } from "../_types";
import { queryLog } from "../_utils";
import { onlineManagerAtom } from "../online-manager-atom";

export type RefetchReason = "focus" | "reconnect" | "interval" | "manual";

// Helper function to check conditions and trigger query
const attemptRefetch = async <TData>(
  reason: RefetchReason,
  key: string,
  triggerQuery: () => Promise<void> | void,
  hasFetchedOnce: boolean,
  promiseStateSignal: MappedSignal<{
    Events: GenericEventMap;
    State: PromiseState<TData | undefined>;
  }>,
  promiseMetaSignal: MappedSignal<{
    Events: GenericEventMap;
    State: PromiseMeta;
  }>,
  wasTriggeredSignal: Signal<{ State: boolean; Events: GenericEventMap }>,
  options: Pick<
    QueryAtomOptions<TData>,
    "enabled" | "lazy" | "staleTime" | "debug"
  > & { staleTime: number },
  ecosystem: Ecosystem,
) => {
  const { enabled, lazy, staleTime, debug } = options;

  queryLog(debug, `Query ${key}: attemptRefetch triggered by ${reason}.`);

  if (!enabled) {
    queryLog(
      debug,
      `Query ${key}: attemptRefetch (${reason}) - Skipped (disabled).`,
    );
    return;
  }

  if (lazy && !hasFetchedOnce) {
    queryLog(
      debug,
      `Query ${key}: attemptRefetch (${reason}) - Skipped (lazy and never fetched).`,
    );
    return;
  }

  const currentState = promiseStateSignal.get();
  const currentMeta = promiseMetaSignal.get();
  const isStale =
    !!currentMeta.lastUpdated &&
    Date.now() - currentMeta.lastUpdated > staleTime;

  queryLog(
    debug,
    `Query ${key}: attemptRefetch (${reason}) - Is Stale: ${isStale}, Is Loading: ${currentState.isLoading}`,
  );

  if (isStale && !currentState.isLoading) {
    queryLog(
      debug,
      `Query ${key}: attemptRefetch (${reason}) - Conditions met, triggering query.`,
    );
    ecosystem.batch(() => {
      triggerQuery();
      if (lazy && hasFetchedOnce) {
        wasTriggeredSignal.set(true);
      }
    });
  } else {
    queryLog(
      debug,
      `Query ${key}: attemptRefetch (${reason}) - Skipping trigger (not stale or already loading).`,
    );
  }
};

export const injectRefetch = <TData>(
  key: string,
  queryControlRef: MutableRefObject<TQueryControl<TData>>,
  promiseStateSignal: MappedSignal<{
    Events: GenericEventMap;
    State: PromiseState<TData | undefined>;
  }>,
  promiseMetaSignal: MappedSignal<{
    Events: GenericEventMap;
    State: PromiseMeta;
  }>,
  wasTriggeredSignal: Signal<{ State: boolean; Events: GenericEventMap }>,
  triggerQuery: () => void,
  options: Pick<
    QueryAtomOptions<TData>,
    | "enabled"
    | "refetchOnFocus"
    | "refetchOnReconnect"
    | "refetchIntervalInBackground"
    | "refetchInterval"
    | "lazy"
    | "staleTime"
    | "debug"
  > & { staleTime: number },
) => {
  const {
    enabled,
    refetchOnFocus,
    refetchOnReconnect,
    refetchIntervalInBackground,
    refetchInterval,
    lazy,
    staleTime,
    debug,
  } = options;
  const ecosystem = injectEcosystem();
  const commonOptions = { enabled, lazy, staleTime, debug };

  // --- Refetch on Focus Logic ---
  injectEffect(() => {
    if (!enabled || !refetchOnFocus || typeof window === "undefined") {
      queryLog(debug, `Query ${key}: Focus effect skipped (initial check).`);
      return;
    }

    const handleFocus = () =>
      attemptRefetch(
        "focus",
        key,
        triggerQuery,
        queryControlRef.current.hasFetchedOnce,
        promiseStateSignal,
        promiseMetaSignal,
        wasTriggeredSignal,
        commonOptions,
        ecosystem,
      );

    queryLog(debug, `Query ${key}: Adding focus/visibility listeners.`);
    window.addEventListener("focus", handleFocus, false);
    window.addEventListener("visibilitychange", handleFocus, false);

    return () => {
      queryLog(debug, `Query ${key}: Cleaning up focus/visibility listeners.`);
      window.removeEventListener("focus", handleFocus, false);
      window.removeEventListener("visibilitychange", handleFocus, false);
    };
  }, [enabled, refetchOnFocus, lazy, staleTime, debug, triggerQuery]);

  const isOnline = injectAtomValue(onlineManagerAtom);
  queryLog(debug, `Query ${key}: Online status: ${isOnline}`);

  // --- Refetch on Reconnect Logic ---
  injectEffect(() => {
    if (!enabled || !refetchOnReconnect || typeof window === "undefined") {
      queryLog(
        debug,
        `Query ${key}: Reconnect effect skipped (initial check).`,
      );
      return;
    }

    if (isOnline) {
      queryLog(debug, `Query ${key}: Reconnect detected (online).`);

      attemptRefetch(
        "reconnect",
        key,
        triggerQuery,
        queryControlRef.current.hasFetchedOnce,
        promiseStateSignal,
        promiseMetaSignal,
        wasTriggeredSignal,
        commonOptions,
        ecosystem,
      );
    } else {
      queryLog(debug, `Query ${key}: Reconnect effect - Detected offline.`);
    }
  }, [
    enabled,
    refetchOnReconnect,
    isOnline,
    lazy,
    staleTime,
    debug,
    triggerQuery,
  ]);

  // --- Refetch Interval Logic ---
  injectEffect(() => {
    if (
      !enabled ||
      typeof window === "undefined" ||
      !refetchInterval ||
      refetchInterval <= 0
    ) {
      queryLog(debug, `Query ${key}: Interval effect skipped (initial check).`);
      return;
    }

    queryLog(
      debug,
      `Query ${key}: Setting up interval (${refetchInterval}ms).`,
    );
    const intervalId = setInterval(() => {
      queryLog(debug, `Query ${key}: Interval triggered.`);

      if (!refetchIntervalInBackground && !document.hasFocus()) {
        queryLog(
          debug,
          `Query ${key}: Interval - Skipping (background refetch disabled and window not focused).`,
        );
        return;
      }

      // Interval refetch ignores staleness, just checks enabled and loading status
      if (lazy && !queryControlRef.current.hasFetchedOnce) {
        queryLog(
          debug,
          `Query ${key}: Interval - Skipping (lazy and never fetched).`,
        );
        return;
      }
      const currentState = promiseStateSignal.get();
      if (enabled && !currentState.isLoading) {
        queryLog(debug, `Query ${key}: Interval - Triggering query.`);
        triggerQuery(); // Directly trigger, don't need attemptRefetch's staleness check
      } else {
        queryLog(
          debug,
          `Query ${key}: Interval - Skipping trigger (disabled or already loading).`,
        );
      }
    }, refetchInterval);

    return () => {
      queryLog(debug, `Query ${key}: Cleaning up interval.`);
      clearInterval(intervalId);
    };
  }, [
    enabled,
    refetchInterval,
    refetchIntervalInBackground,
    lazy,
    debug,
    triggerQuery,
  ]);
};
