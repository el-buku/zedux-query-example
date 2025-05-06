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
    type MappedSignal,
    type PromiseState,
    type Signal,
    type Ecosystem,
    type AnyAtomTemplate,
    type AtomGenerics,
    type AtomTemplateBase,
    type AnyAtomInstance,
    type AnyAtomGenerics,
    type AtomStateFactory,
    injectCallback,
} from "@zedux/react";
import { onlineManagerAtom } from "../online-manager";
import {
    shouldRetry,
    getRetryDelay,
    queryLog,
    CONFIG_DEFAULTS,
} from "../_utils";

import type {
    QueryFactoryTemplate,
    QueryAtomOptions,
    PromiseMeta,
} from "../_types";
import { injectRefetch } from "./inject-refetch";
import { injectQueryState } from "./inject-query-state"; // Import state machine injector

export const injectQuery = <TData, TError>(
    key: string,
    queryFn: () => Promise<TData>,
    options: QueryAtomOptions<TData, TError>
) => {
    const {
        lazy,
        suspense,
        refetchOnMount = CONFIG_DEFAULTS.refetchOnMount,
        refetchOnFocus = CONFIG_DEFAULTS.refetchOnFocus,
        refetchOnReconnect = CONFIG_DEFAULTS.refetchOnReconnect,
        refetchIntervalInBackground = CONFIG_DEFAULTS.refetchIntervalInBackground,
        refetchInterval,
        broadcast,
        onSuccess,
        onError,
        onSettled,
        retry = CONFIG_DEFAULTS.retry,
        retryDelay,
        maxRetries = CONFIG_DEFAULTS.maxRetries,
        throwOnError,
        staleTime = CONFIG_DEFAULTS.staleTime,
        enabled,
        debug = CONFIG_DEFAULTS.debug,
        swr = CONFIG_DEFAULTS.swr,
        initialData,
    } = options;
    const wasTriggeredSignal = injectSignal<boolean>(suspense || !lazy);
    const wasTriggered = wasTriggeredSignal.get();
    const isEnabled = injectMemo(
        () => wasTriggered || enabled,
        [wasTriggered, enabled]
    );
    const controllerRef = injectRef<AbortController | undefined>(undefined);
    const hasFetchedOnceRef = injectRef(false);
    const isRetryRef = injectRef(false);
    const retryTimeoutIdRef = injectRef<NodeJS.Timeout | null>(null);
    const failureCountRef = injectRef(0);
    const activeFetchPromiseRef = injectRef<Promise<TData | undefined> | null>(
        null
    );
    const ecosystem = injectEcosystem();
    const self = injectSelf();
    const lastUpdatedSignal = injectSignal<number | null>(null);
    const promiseMetaSignal = injectMappedSignal({
        lastUpdated: lastUpdatedSignal,
    });
    const queryStateMachine = injectQueryState();
    const send = queryStateMachine.send;

    const invalidateFn = injectCallback(() => {
        const isRetry = isRetryRef.current;
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
        queryLog(debug, `Query ${key}: Calling self.invalidate()`);
        self.invalidate();
    }, [self]);

    const handleFetchSuccess = async (data: TData) => {
        queryLog(debug, `Query ${key}: handleFetchSuccess - Success. Data:`, data);
        failureCountRef.current = 0;
        if (retryTimeoutIdRef.current) {
            clearTimeout(retryTimeoutIdRef.current);
            retryTimeoutIdRef.current = null;
            queryLog(
                debug,
                `Query ${key}: handleFetchSuccess - Cleared pending retry timeout.`
            );
        }
        send("fetchSuccessful");
        lastUpdatedSignal.set(Date.now());
        const onSuccessReturn = onSuccess ? await onSuccess(data) : data;
        const onSuccessResult = onSuccessReturn ? onSuccessReturn : data;
        if (onSettled) {
            onSettled(onSuccessResult, undefined);
        }
        queryLog(
            debug,
            `Query ${key}: handleFetchSuccess - Called onSuccess/onSettled.`
        );
        // TODO: Broadcast update
        return onSuccessResult;
    };

    const handleFetchError = async (error: TError) => {
        queryLog(debug, `Query ${key}: handleFetchError - Error:`, error);
        failureCountRef.current++;
        queryLog(
            debug,
            `Query ${key}: handleFetchError - Failure count: ${failureCountRef.current}`
        );

        const doRetry = shouldRetry(
            failureCountRef.current,
            error,
            retry,
            maxRetries
        );
        queryLog(
            debug,
            `Query ${key}: handleFetchError - Should retry? ${doRetry}`
        );

        if (doRetry) {
            const delay = getRetryDelay(failureCountRef.current, retryDelay);
            queryLog(
                debug,
                `Query ${key}: handleFetchError - Scheduling retry in ${delay}ms.`
            );
            send("retry");

            return new Promise<TData | undefined>((resolve) => {
                retryTimeoutIdRef.current = setTimeout(() => {
                    queryLog(
                        debug,
                        `Query ${key}: handleFetchError - Retry timeout finished. Invalidating.`
                    );
                    isRetryRef.current = true;
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

            const isRetry = isRetryRef.current;
            controllerRef.current = controller;
            isRetryRef.current = false; // Reset after capturing

            if (!isRetry) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Sending 'request' event.`
                );
                send("request");
            }

            if (!isRetry && retryTimeoutIdRef.current) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Clearing pending retry timeout.`
                );
                clearTimeout(retryTimeoutIdRef.current);
                retryTimeoutIdRef.current = null;
            }

            if (!hasFetchedOnceRef.current) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Marking first fetch attempt.`
                );
                hasFetchedOnceRef.current = true;
            }

            if (!isRetry) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Resetting failure count.`
                );
                failureCountRef.current = 0;
            }

            const currentFetchPromise = activeFetchPromiseRef.current;
            if (currentFetchPromise) {
                queryLog(
                    debug,
                    `Query ${key}: queryFactory - Returning existing active fetch promise.`
                );
                return currentFetchPromise;
            }

            const fetchPromise = (async (): Promise<TData | undefined> => {
                try {
                    queryLog(debug, `Query ${key}: queryFactory - Executing queryFn.`);
                    const data = await queryFn();
                    const mutatedData = await handleFetchSuccess(data);
                    return mutatedData;
                } catch (error) {
                    const typedError = error as TError;
                    return await handleFetchError(typedError); // Await potential retry promise
                } finally {
                    queryLog(
                        debug,
                        `Query ${key}: queryFactory - Clearing active fetch promise ref.`
                    );
                    activeFetchPromiseRef.current = null;
                }
            })();

            queryLog(
                debug,
                `Query ${key}: queryFactory - Storing new active fetch promise.`
            );
            activeFetchPromiseRef.current = fetchPromise;
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
            swr, // Needed for invalidateFn logic
            debug, // Needed for logging
            throwOnError, // Needed for error handling
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
            if (retryTimeoutIdRef.current) {
                queryLog(debug, `Query ${key}: Clearing retry timeout on cleanup.`);
                clearTimeout(retryTimeoutIdRef.current);
            }
            wasTriggeredSignal.set(false);
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
        if (controllerRef.current) {
            controllerRef.current.abort();
        }
    };
    injectRefetch(
        key,
        hasFetchedOnceRef,
        queryApi.signal as MappedSignal<{
            Events: Record<string, any>;
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
    injectEffect(() => {
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
    }, [queryStateMachineVal]);

    // queryLog(debug, `Query ${key}: queryState:`, queryState);

    const querySignal = injectMappedSignal({
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
