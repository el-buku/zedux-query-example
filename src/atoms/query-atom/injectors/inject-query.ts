import {
    atom,
    api,
    injectPromise,
    injectEffect,
    injectSelf,
    injectRef,
    injectAtomValue,
    injectAtomInstance,
    injectSignal,
    injectEcosystem,
    injectMappedSignal,
    injectMemo,
    type MutableRefObject,
    type AtomTemplateRecursive,
    type MappedSignal,
    type PromiseState,
    type Ecosystem,
    type AnyAtomTemplate,
    type AtomGenerics,
    type AtomTemplateBase,
    type AnyAtomInstance,
    type AnyAtomGenerics,
    type AtomStateFactory,
    injectCallback,
    injectAtomState,
} from "@zedux/react";
import { onlineManagerAtom } from "../online-manager";
import { shouldRetry, getRetryDelay, queryLog } from "../_utils";
import { crossParamCacheAtom, } from '../query-cache'; // really want to get rid of this

import type {
    QueryFactoryTemplate,
    QueryAtomOptions,
    PromiseMeta,
    TQueryControl,
    TQueryDef,
    QueryAtomLifecycleOptions,
    CachedQueryEntry,
} from "../_types";
import { injectRefetch } from "./inject-refetch";
import { injectQueryState } from "./inject-query-state";
import { queryConfigAtom } from "../config-atom";
import { injectQueryLifecycle } from "./inject-query-lifecycle";

export const injectQuery = <
    TData,
    TError,
    TCombinedParams extends unknown[]  // Combined parameters from TQueryDef
>(
    key: string,
    queryKey: string,
    queryDef: TQueryDef<TData, TCombinedParams>,
    options: QueryAtomOptions<TData, TError, TCombinedParams> // Options are now generic over TCombinedParams
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
        ttl
    } = options;
    const queryFn = queryDef.queryFn;
    const wasTriggeredSignal = injectSignal<boolean>(suspense || !lazy);
    const wasFetchStartedSignal = injectSignal<boolean>(false);
    const errorSignal = injectSignal<TError | undefined>(undefined);
    const wasTriggered = wasTriggeredSignal.get();
    const isEnabled = injectMemo(
        () => wasTriggered || enabled,
        [wasTriggered, enabled]
    );

    const queryControlRef = injectRef<TQueryControl<TData>>({
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
    const currentCrossParamCacheInstance = injectAtomInstance(crossParamCacheAtom, [key, ttl])

    const invalidateFn = injectCallback(() => {
        const isRetry = queryControlRef.current.isRetry;
        queryLog(debug, `Query ${key}: Invalidation triggered.`);
        queryLog(
            debug,
            `Query ${key}: Sending 'invalidate' event to state machine.`
        );
        send("invalidate");

        if (lazy && !isRetry) {
            wasTriggeredSignal.set(false);
        }
        queryLog(
            debug,
            `Query ${key}: Invalidate: ${swr ? "preserving data (SWR)" : "clearing dataSignal."}`
        );
        if (!swr) {
            queryApi.dataSignal.set(undefined);
        }
        currentCrossParamCacheInstance.exports.setCache(queryKey, null);
        queryLog(debug, `Query ${key}: Calling self.invalidate()`);
        self.invalidate();
    }, [self]);

    const handleFetchSuccess = async (
        data: TData,
        mergeCallback: QueryAtomOptions<TData, TError, TCombinedParams>["merge"]
    ) => {
        queryLog(debug, `Query ${key}: handleFetchSuccess - Success. Data:`, data);
        queryControlRef.current.failureCount = 0;
        if (queryControlRef.current.retryTimeoutId) {
            clearTimeout(queryControlRef.current.retryTimeoutId);
            queryControlRef.current.retryTimeoutId = null;
            queryLog(
                debug,
                `Query ${key}: handleFetchSuccess - Cleared pending retry timeout.`
            );
        }
        send("fetchSuccessful");
        const fulfilledTimestamp = Date.now();
        lastUpdatedSignal.set(fulfilledTimestamp);
        const onSuccessReturn = onSuccess ? await onSuccess(data) : data;

        const onSuccessResult = onSuccessReturn !== undefined ? onSuccessReturn : data;

        // get latest cache entry for this serialized queryKey
        const crossParamPrevDataEntry = currentCrossParamCacheInstance.exports.getCache(queryKey)

        const mergedResult = mergeCallback
            ? mergeCallback(
                crossParamPrevDataEntry as CachedQueryEntry<TData, TCombinedParams>, // type casting cause im not sure how to specify generics on injectAtomInstance
                onSuccessResult,
                {
                    params: queryDef.params, // Current params for this fetch
                    fulfilledTimestamp,
                }
            )
            : onSuccessResult;

        // Update the cache cache
        const newCacheEntry: CachedQueryEntry<TData, TCombinedParams> = {
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
            `Query ${key}: handleFetchSuccess - Called onSuccess/onSettled. Updated cross-param cache.`
        );
        console.log("mergedResult", mergedResult);
        return mergedResult;
    };

    const handleFetchError = async (error: TError) => {
        queryLog(debug, `Query ${key}: handleFetchError - Error:`, error);
        queryControlRef.current.failureCount++;
        queryLog(
            debug,
            `Query ${key}: handleFetchError - Failure count: ${queryControlRef.current.failureCount}`
        );

        const doRetry = shouldRetry(
            queryControlRef.current.failureCount,
            error,
            retry,
            maxRetries
        );
        queryLog(
            debug,
            `Query ${key}: handleFetchError - Should retry? ${doRetry}`
        );

        if (doRetry) {
            const delay = getRetryDelay(
                queryControlRef.current.failureCount,
                retryDelay,
                delayUnit,
                maxRetryDelay
            );
            queryLog(
                debug,
                `Query ${key}: handleFetchError - Scheduling retry in ${delay}ms.`
            );
            send("retry");

            return new Promise<TData | undefined>((resolve) => {
                queryControlRef.current.retryTimeoutId = setTimeout(() => {
                    queryLog(
                        debug,
                        `Query ${key}: handleFetchError - Retry timeout finished. Invalidating.`
                    );
                    queryControlRef.current.isRetry = true;
                    invalidateFn();
                    resolve(undefined); // Resolve the placeholder promise
                }, delay);
            });
        }
        queryLog.error(
            debug,
            `Query ${key}: handleFetchError - Retries exhausted or disabled.`
        );
        send("fetchFailed");
        const onErrorReturn = onError ? await onError(error) : error;
        const onErrorResult = onErrorReturn ? onErrorReturn : error;
        if (onSettled) {
            onSettled(undefined, onErrorResult);
        }
        queryLog(
            debug,
            `Query ${key}: handleFetchError - Called onError/onSettled.`
        );
        errorSignal.set(error);
        if (throwOnError) {
            queryLog(debug, `Query ${key}: handleFetchError - Rethrowing error.`);
            throw error;
        }
        return Promise.resolve(undefined); // Explicitly return undefined if not retrying/throwing
    };

    const queryApi = injectPromise<TData | undefined>(
        async function queryFactory({
            controller,
            prevData,
        }): Promise<TData | undefined> {
            queryLog(
                debug,
                `Query ${key}: queryFactory() called. Controller:`,
                controller,
                "PrevData:",
                prevData
            );

            if (!isEnabled) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Skipped: Query disabled.`
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
                    `Query ${key}: queryFactory - Sending 'request' event.`
                );
                send("request");
            }

            if (!isRetry && queryControlRef.current.retryTimeoutId) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Clearing pending retry timeout.`
                );
                clearTimeout(queryControlRef.current.retryTimeoutId);
                queryControlRef.current.retryTimeoutId = null;
            }

            if (!queryControlRef.current.hasFetchedOnce) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Marking first fetch attempt.`
                );
                queryControlRef.current.hasFetchedOnce = true;
            }

            if (!isRetry) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Resetting failure count.`
                );
                queryControlRef.current.failureCount = 0;
            }

            const currentFetchPromise = queryControlRef.current.activeFetchPromise;
            if (currentFetchPromise) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Returning existing active fetch promise.`
                );
                return currentFetchPromise;
            }

            const fetchPromise = (async (): Promise<TData | undefined> => {
                try {
                    queryLog(
                        debug,
                        `Query ${key}: queryFactory - Executing queryFn.${queryFn}`
                    );
                    const data = await queryFn();

                    const mutatedData = await handleFetchSuccess(data, merge);
                    console.log("mutatedData", mutatedData);
                    return mutatedData;
                } catch (error) {
                    const typedError = error as TError;
                    return await handleFetchError(typedError); // Await potential retry promise
                } finally {
                    queryLog(
                        debug,
                        `Query ${key}: queryFactory - Clearing active fetch promise ref.`
                    );
                    queryControlRef.current.activeFetchPromise = null;
                }
            })();

            queryLog(
                debug,
                `Query ${key}: queryFactory - Storing new active fetch promise.`
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
                    ? (initialData as () => TData)()
                    : initialData,
        }
    );

    // --- Cleanup Logic ---
    injectEffect(() => {
        queryLog(debug, `Query ${key}: Cleanup effect (retry timeout) registered.`);
        // Clear retry timeout on atom destruction
        return () => {
            queryLog(debug, `Query ${key}: Cleanup effect (retry timeout) running.`);
            if (queryControlRef.current.retryTimeoutId) {
                queryLog(debug, `Query ${key}: Clearing retry timeout on cleanup.`);
                clearTimeout(queryControlRef.current.retryTimeoutId);
            }
            // wasTriggeredSignal.set(false);
        };
    }, []);

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
            Events: Record<string, unknown>;
            State: PromiseState<TData | undefined>;
        }>,
        promiseMetaSignal,
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
        }
    );

    const queryStateMachineVal = queryStateMachine.getValue();
    const isIdleSignal = injectSignal<boolean>(queryStateMachineVal === "idle");
    const isLoadingSignal = injectSignal<boolean>(
        queryStateMachineVal === "fetching"
    );
    const isFetchingSignal = injectSignal<boolean>(
        queryStateMachineVal === "fetching"
    );
    const isSuccessSignal = injectSignal<boolean>(
        queryStateMachineVal === "success"
    );
    const isErrorSignal = injectSignal<boolean>(queryStateMachineVal === "error");
    const queryStateSignal = injectSignal<
        "error" | "success" | "idle" | "fetching"
    >(queryStateMachineVal);

    // injectQueryLifecycle's TParams generic will be TCombinedParams
    injectQueryLifecycle<TData, TError, TCombinedParams>(
        key,
        wasFetchStartedSignal,
        queryDef,
        queryApi.dataSignal,
        errorSignal,
        queryStateSignal,
        {
            onQueryStarted,
            onCacheEntryAdded
        },
        debug
    );

    injectEffect(
        () => {
            let isIdle = false;
            let isFetching = false;
            let isSuccess = false;
            let isError = false;
            let isLoading = true;
            const status = queryStateMachineVal;
            if (status === "idle") {
                isIdle = true;
            } else if (status === "fetching") {
                isFetching = true;
                if (swr && merge) {
                    const prevResult = currentCrossParamCacheInstance.exports.getCache(queryKey)
                    // very very very ugly hack
                    if (prevResult) {
                        queryApi.dataSignal.set(prevResult.data as TData); // type casting cause im not sure how to specify generics on injectAtomInstance
                    }
                }
            } else if (status === "success") {
                isSuccess = true;
            } else if (status === "error") {
                isError = true;
            }
            if (queryApi.dataSignal.get() || isError) {
                isLoading = false;
            }
            isIdleSignal.set(isIdle);
            isFetchingSignal.set(isFetching);
            isSuccessSignal.set(isSuccess);
            isErrorSignal.set(isError);
            queryStateSignal.set(status);
            isLoadingSignal.set(isLoading);
        },
        [queryStateMachineVal],
        {
            synchronous: true,
        }
    );

    // queryLog(debug, `Query ${key}: queryState:`, queryState);

    const querySignal = injectMappedSignal({
        error: errorSignal,
        data: queryApi.dataSignal,
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
        // Only set promise for suspense if initially not triggered
        queryLog(debug, `Query ${key}: Setting promise for suspense (initial).`);
        return qapi.setPromise(queryApi.promise);
    }

    queryLog(debug, `Query ${key}: Returning qapi.`);
    return qapi;
};
