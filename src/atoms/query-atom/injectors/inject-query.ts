import {
  api,
  injectAtomInstance,
  injectAtomValue,
  injectCallback,
  injectEcosystem,
  injectEffect,
  injectMappedSignal,
  injectMemo,
  injectPromise,
  injectRef,
  injectSelf,
  injectSignal,
  injectWhy,
  type MappedSignal,
  type PromiseState,
} from "@zedux/react";
import { injectPersistedSignal } from "./inject-persisted-signal";
import { GenericEventMap } from "../_types";
import type {
  CachedQueryEntry,
  QueryAtomOptions,
  TQueryControl,
  TQueryDef,
} from "../_types";
import { getRetryDelay, queryLog, shouldRetry } from "../_utils";
import { queryConfigAtom } from "../config-atom";
import { crossParamCacheAtom } from "../query-cache-atom"; // really want to get rid of this
import { injectTagInvalidator } from "./inject-invalidator";
import { injectQueryLifecycle } from "./inject-query-lifecycle";
import { injectQueryState } from "./inject-query-state";
import { injectRefetch } from "./inject-refetch";

export const injectQuery = <
  TQueryFnData,
  TFinalData,
  TError extends Record<string, unknown>,
  TCombinedParams extends unknown[], // Combined parameters from TQueryDef
>(
  key: string,
  queryKey: string,
  queryDef: TQueryDef<TQueryFnData, TCombinedParams>,
  options: QueryAtomOptions<TQueryFnData, TFinalData, TError, TCombinedParams>, // Options are now generic over TCombinedParams
) => {
  const configDefaults = injectAtomValue(queryConfigAtom);
  const {
    lazy,
    suspense,
    refetchOnMount = configDefaults.refetchOnMount,
    refetchOnFocus = configDefaults.refetchOnFocus,
    refetchOnReconnect = configDefaults.refetchOnReconnect,
    refetchIntervalInBackground = configDefaults.refetchIntervalInBackground,
    refetchInterval,
    broadcast,
    onSuccess,
    onError,
    onSettled,
    onQueryStarted,
    onCacheEntryAdded,
    merge,
    retry = configDefaults.retry,
    retryDelay,
    maxRetries = configDefaults.maxRetries,
    throwOnError,
    staleTime = configDefaults.staleTime,
    enabled,
    debug = configDefaults.debug,
    swr = configDefaults.swr,
    initialData,
    delayUnit = configDefaults.delayUnit,
    maxRetryDelay = configDefaults.maxRetryDelay,
    ttl,
  } = options;
  const queryFn = queryDef.queryFn;
  const wasTriggeredSignal = injectSignal<boolean>(suspense || !lazy);
  const wasFetchStartedSignal = injectSignal<boolean>(false);
  const errorSignal = injectSignal<TError | undefined>(undefined);
  const wasTriggered = wasTriggeredSignal.get();
  const isEnabled = injectMemo(
    () => wasTriggered && enabled,
    [wasTriggered, enabled],
  );
  const queryControlRef = injectRef<TQueryControl<TFinalData>>({
    controller: undefined,
    hasFetchedOnce: false,
    isRetry: false,
    retryTimeoutId: null,
    failureCount: 0,
    activeFetchPromise: null,
  });

  const ecosystem = injectEcosystem();
  const self = injectSelf();
  const lastUpdatedSignal = injectSignal<number | null>(null);
  const promiseMetaSignal = injectMappedSignal({
    lastUpdated: lastUpdatedSignal,
  });
  const queryStateMachine = injectQueryState();
  const send = queryStateMachine.send;
  const currentCrossParamCacheInstance = injectAtomInstance(
    crossParamCacheAtom,
    [key, ttl],
  );
  const why = injectWhy();
  queryLog(debug, "why", why, queryKey);
  const invalidateFn = injectCallback(() => {
    ecosystem.batch(() => {
      queryLog(debug, "doingbatch", why);
      const isRetry = queryControlRef.current.isRetry;
      queryLog(debug, `Query ${key}: Invalidation triggered.`);
      queryLog(
        debug,
        `Query ${key}: Sending 'invalidate' event to state machine.`,
        queryKey,
      );
      send("invalidate");

      if (lazy && !isRetry) {
        wasTriggeredSignal.set(false);
      }
      queryLog(
        debug,
        `Query ${key}: Invalidate: ${swr ? "preserving data (SWR)" : "clearing dataSignal."}`,
      );
      if (!swr) {
        queryLog(debug, `Query ${key}: Clearing dataSignal.`);
        queryApi.dataSignal.set(undefined);
        dataSignal.set(undefined);
      }
      self.invalidate();
      currentCrossParamCacheInstance.exports.setCache(queryKey, null);
      queryLog(debug, `Query ${key}: Calling self.invalidate()`, queryKey);
    });
  }, [self]);
  const mergedTags = injectMemo(() => {
    const optionsTags =
      typeof options.tags === "function"
        ? options.tags(queryDef.params)
        : (options.tags ?? []);
    return [...optionsTags, ...(queryDef.tags ?? [])];
  }, [options.tags, queryDef]);
  injectTagInvalidator(key, queryKey, invalidateFn, mergedTags);

  const handleFetchSuccess = async (
    data: TQueryFnData,
    mergeCallback: QueryAtomOptions<
      TQueryFnData,
      TFinalData,
      TError,
      TCombinedParams
    >["merge"],
  ) => {
    queryLog(debug, `Query ${key}: handleFetchSuccess - Success. Data:`, data);
    queryControlRef.current.failureCount = 0;
    if (queryControlRef.current.retryTimeoutId) {
      clearTimeout(queryControlRef.current.retryTimeoutId);
      queryControlRef.current.retryTimeoutId = null;
      queryLog(
        debug,
        `Query ${key}: handleFetchSuccess - Cleared pending retry timeout.`,
      );
    }
    send("fetchSuccessful");
    const fulfilledTimestamp = Date.now();
    lastUpdatedSignal.set(fulfilledTimestamp);
    const onSuccessReturn = onSuccess
      ? await onSuccess(data, queryDef.params)
      : data;

    const onSuccessResult =
      onSuccessReturn !== undefined ? onSuccessReturn : data;

    // get latest cache entry for this serialized queryKey
    const crossParamPrevDataEntry =
      currentCrossParamCacheInstance.exports.getCache(queryKey);

    const mergedResult = mergeCallback
      ? mergeCallback(
        crossParamPrevDataEntry as CachedQueryEntry<
          TFinalData,
          TCombinedParams
        >, // type casting cause im not sure how to specify generics on injectAtomInstance
        onSuccessResult as TFinalData,
        {
          params: queryDef.params, // Current params for this fetch
          fulfilledTimestamp,
        },
      )
      : (onSuccessResult as TFinalData);

    // Update the cache cache
    const newCacheEntry: CachedQueryEntry<TFinalData, TCombinedParams> = {
      data: mergedResult,
      params: queryDef.params,
      timestamp: fulfilledTimestamp,
    };

    currentCrossParamCacheInstance.exports.setCache(queryKey, newCacheEntry);

    if (onSettled) {
      // Ensure onSettled gets the final merged data
      await onSettled(mergedResult, undefined);
    }
    queryLog(
      debug,
      `Query ${key}: handleFetchSuccess - Called onSuccess/onSettled. Updated cross-param cache.`,
    );
    return mergedResult;
  };

  const handleFetchError = async (error: TError) => {
    queryLog(debug, `Query ${key}: handleFetchError - Error:`, error);
    queryControlRef.current.failureCount++;
    queryLog(
      debug,
      `Query ${key}: handleFetchError - Failure count: ${queryControlRef.current.failureCount}`,
    );

    const doRetry = shouldRetry(
      queryControlRef.current.failureCount,
      error,
      retry,
      maxRetries,
    );
    queryLog(
      debug,
      `Query ${key}: handleFetchError - Should retry? ${doRetry}`,
    );

    if (doRetry) {
      const delay = getRetryDelay(
        queryControlRef.current.failureCount,
        retryDelay,
        delayUnit,
        maxRetryDelay,
      );
      queryLog(
        debug,
        `Query ${key}: handleFetchError - Scheduling retry in ${delay}ms.`,
      );
      send("retry");

      return new Promise<TFinalData | undefined>((resolve) => {
        queryControlRef.current.retryTimeoutId = setTimeout(() => {
          queryLog(
            debug,
            `Query ${key}: handleFetchError - Retry timeout finished. Invalidating.`,
          );
          queryControlRef.current.isRetry = true;
          invalidateFn();
          resolve(undefined); // Resolve the placeholder promise
        }, delay);
      });
    }
    queryLog.error(
      debug,
      `Query ${key}: handleFetchError - Retries exhausted or disabled.`,
    );
    send("fetchFailed");
    const onErrorReturn = onError
      ? await onError(error, queryDef.params)
      : error;
    const onErrorResult = onErrorReturn ? onErrorReturn : error;
    if (onSettled) {
      onSettled(undefined, onErrorResult, queryDef.params);
    }
    queryLog(
      debug,
      `Query ${key}: handleFetchError - Called onError/onSettled.`,
    );
    errorSignal.set(error);
    if (throwOnError) {
      queryLog(debug, `Query ${key}: handleFetchError - Rethrowing error.`);
      throw error;
    }
    return Promise.resolve(undefined); // Explicitly return undefined if not retrying/throwing
  };

  const queryApi = injectPromise<TFinalData | undefined>(
    async function queryFactory({
      controller,
      prevData,
    }): Promise<TFinalData | undefined> {
      queryLog(
        debug,
        `Query ${key}: queryFactory() called. Controller:`,
        controller,
        "PrevData:",
        prevData,
        "isEnabled",
        isEnabled,
      );

      if (!isEnabled) {
        queryLog(
          debug,
          `Query ${key}: queryFactory - Skipped: Query disabled.`,
        );
        return Promise.resolve(undefined);
      }
      errorSignal.set(undefined);
      wasFetchStartedSignal.set(true);
      const isRetry = queryControlRef.current.isRetry;
      queryControlRef.current.controller = controller;
      queryControlRef.current.isRetry = false; // Reset after capturing

      if (!isRetry) {
        queryLog(
          debug,
          `Query ${key}: queryFactory - Sending 'request' event.`,
        );
        send("request");
      }

      if (!isRetry && queryControlRef.current.retryTimeoutId) {
        queryLog(
          debug,
          `Query ${key}: queryFactory - Clearing pending retry timeout.`,
        );
        clearTimeout(queryControlRef.current.retryTimeoutId);
        queryControlRef.current.retryTimeoutId = null;
      }

      if (!queryControlRef.current.hasFetchedOnce) {
        queryLog(
          debug,
          `Query ${key}: queryFactory - Marking first fetch attempt.`,
        );
        queryControlRef.current.hasFetchedOnce = true;
      }

      if (!isRetry) {
        queryLog(
          debug,
          `Query ${key}: queryFactory - Resetting failure count.`,
        );
        queryControlRef.current.failureCount = 0;
      }

      const currentFetchPromise = queryControlRef.current.activeFetchPromise;
      if (currentFetchPromise) {
        queryLog(
          debug,
          `Query ${key}: queryFactory - Returning existing active fetch promise.`,
        );
        return currentFetchPromise;
      }

      const fetchPromise = (async (): Promise<TFinalData | undefined> => {
        try {
          queryLog(
            debug,
            `Query ${key}: queryFactory - Executing queryFn.${queryFn}`,
          );
          const data = await queryFn();

          const mutatedData = await handleFetchSuccess(data, merge);
          return mutatedData;
        } catch (error) {
          if (error instanceof Response) {
            const status = error.status;
            const statusText = error.statusText;
            const jsonErrorResponse = (await error.json()) as {
              message: string;
            };
            return await handleFetchError({
              message: jsonErrorResponse.message,
              status,
              statusText,
            } as unknown as TError);
          }
          const typedError = error as TError;
          return await handleFetchError({
            message: typedError.message,
            status: typedError.status,
            statusText: typedError.statusText,
          } as unknown as TError); // Await potential retry promise
        } finally {
          queryLog(
            debug,
            `Query ${key}: queryFactory - Clearing active fetch promise ref.`,
          );
          queryControlRef.current.activeFetchPromise = null;
        }
      })();

      queryLog(
        debug,
        `Query ${key}: queryFactory - Storing new active fetch promise.`,
      );
      queryControlRef.current.activeFetchPromise = fetchPromise;
      return fetchPromise;
    },
    [
      queryFn,
      isEnabled,
      lazy,
      staleTime,
      refetchOnMount,
      refetchOnFocus,
      refetchOnReconnect,
      refetchIntervalInBackground,
      broadcast,
      onSuccess,
      onError,
      onSettled,
      throwOnError,
      ecosystem,
      self,
      wasTriggered,
      retry,
      retryDelay,
      maxRetries,
      swr,
      debug,
    ],
    {
      runOnInvalidate: true,
      initialData:
        typeof initialData === "function"
          ? (initialData as () => TFinalData)()
          : initialData,
    },
  );

  // --- Cleanup Logic ---
  injectEffect(
    () => {
      queryLog(
        debug,
        `Query ${key}: Cleanup effect (retry timeout) registered.`,
      );
      // Clear retry timeout on atom destruction
      return () => {
        queryLog(
          debug,
          `Query ${key}: Cleanup effect (retry timeout) running.`,
        );
        if (queryControlRef.current.retryTimeoutId) {
          queryLog(debug, `Query ${key}: Clearing retry timeout on cleanup.`);
          clearTimeout(queryControlRef.current.retryTimeoutId);
        }
        // wasTriggeredSignal.set(false);
      };
    },
    [],
    { synchronous: true },
  );

  const fetch = () => {
    queryLog(debug, `Query ${key}: fetch() called.`);
    wasTriggeredSignal.set(true);
    // Don't force 'request' here; let the queryFactory handle it based on state.
    // If injectPromise runs due to wasTriggeredSignal change, it will send 'request'.
    return queryApi.promise;
  };

  const cancel = () => {
    if (queryControlRef.current.controller) {
      queryControlRef.current.controller.abort();
    }
  };
  injectRefetch(
    key,
    queryControlRef,
    queryApi.signal as MappedSignal<{
      Events: GenericEventMap;
      State: PromiseState<TFinalData | undefined>;
    }>,
    promiseMetaSignal,
    wasTriggeredSignal,
    invalidateFn,
    {
      enabled: !!isEnabled,
      refetchOnFocus: !!refetchOnFocus,
      refetchOnReconnect: !!refetchOnReconnect,
      refetchIntervalInBackground: !!refetchIntervalInBackground,
      refetchInterval,
      lazy: !!lazy,
      staleTime,
      debug,
    },
  );

  const queryStateMachineVal = queryStateMachine.getValue();
  const isIdleSignal = injectSignal<boolean>(queryStateMachineVal === "idle");
  const isLoadingSignal = injectSignal<boolean>(
    queryStateMachineVal === "fetching",
  );
  const isFetchingSignal = injectSignal<boolean>(
    queryStateMachineVal === "fetching",
  );
  const isSuccessSignal = injectSignal<boolean>(
    queryStateMachineVal === "success",
  );
  const isErrorSignal = injectSignal<boolean>(queryStateMachineVal === "error");
  const queryStateSignal = injectSignal<
    "error" | "success" | "idle" | "fetching"
  >(queryStateMachineVal);

  // injectQueryLifecycle's TParams generic will be TCombinedParams
  injectQueryLifecycle<TQueryFnData, TFinalData, TError, TCombinedParams>(
    key,
    wasFetchStartedSignal,
    queryDef,
    queryApi.dataSignal,
    errorSignal,
    queryStateSignal,
    {
      onQueryStarted,
      onCacheEntryAdded,
    },
    debug,
  );

  injectEffect(
    () => {
      let isIdle = false;
      let isFetching = false;
      let isSuccess = false;
      let isError = false;
      const status = queryStateMachineVal;
      if (status === "idle") {
        isIdle = true;
      } else if (status === "fetching") {
        isFetching = true;
        if (swr && merge) {
          const prevResult =
            currentCrossParamCacheInstance.exports.getCache(queryKey);
          // very very very ugly hack
          if (prevResult) {
            queryApi.dataSignal.set(prevResult.data as TFinalData); // type casting cause im not sure how to specify generics on injectAtomInstance
          }
        }
      } else if (status === "success") {
        isSuccess = true;
      } else if (status === "error") {
        isError = true;
      }

      isIdleSignal.set(isIdle);
      isFetchingSignal.set(isFetching);
      isSuccessSignal.set(isSuccess);
      isErrorSignal.set(isError);
      queryStateSignal.set(status);
    },
    [queryStateMachineVal],
    {
      synchronous: true,
    },
  );

  const queryData = queryApi.dataSignal.get();
  const dataSignal = options.persist
    ? injectPersistedSignal({
      key: `${queryKey}-persisted-signal`,
      defaultValue: queryData,
    })
    : injectSignal(queryData);

  injectEffect(
    () => {
      const status = queryStateMachineVal;
      let isLoading = false;
      if (!queryData && status !== "error") {
        isLoading = true;
      }
      dataSignal.set(queryData);
      isLoadingSignal.set(isLoading);
    },
    [queryStateMachineVal, queryData],
    { synchronous: true },
  );
  const querySignal = injectMappedSignal({
    data: queryApi.dataSignal,
    error: errorSignal,
    isIdle: isIdleSignal,
    isFetching: isFetchingSignal,
    isSuccess: isSuccessSignal,
    isError: isErrorSignal,
    status: queryStateSignal,
    lastUpdated: lastUpdatedSignal,
    isLoading: isLoadingSignal,
  });

  const baseExports = { invalidate: invalidateFn, fetch, cancel };
  const qapi = api(querySignal).setExports(baseExports);

  if (suspense) {
    queryLog(debug, `Query ${key}: Setting promise for suspense (initial).`);
    return qapi.setPromise(queryApi.promise);
  }

  queryLog(debug, `Query ${key}: Returning qapi.`);
  return qapi;
};
