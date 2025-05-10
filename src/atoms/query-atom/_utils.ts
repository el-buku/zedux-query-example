import type { QueryAtomOptions } from "./_types";


export const shouldRetry = <TData, TError>(
    failureCount: number,
    error: TError,
    retry: QueryAtomOptions<TData, TError>["retry"],
    maxRetries: number
): boolean => {
    if (typeof retry === "function") {
        return retry(failureCount, error);
    }
    return failureCount < maxRetries;
};

export const BASE_CONFIG_DEFAULTS = {
    enabled: true,
    maxRetries: 3,
    staleTime: 0,
    retry: false,
    delayUnit: 1000,
    refetchOnMount: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
    ttl: 0,
    maxRetryDelay: 30000,
    debug: true,
    swr: true,
    suspense: false,
    lazy: false,
    broadcast: false,
};


export const getRetryDelay = <TData, TError>(
    attemptIndex: number,
    retryDelay: QueryAtomOptions<TData, TError>["retryDelay"],
    delayUnit: number,
    maxRetryDelay: number
): number => {
    if (typeof retryDelay === "function") {
        return retryDelay(attemptIndex);
    }
    if (typeof retryDelay === "number") {
        return retryDelay;
    }
    // Default exponential backoff
    return Math.min(delayUnit * 2 ** attemptIndex, maxRetryDelay); // Capped at 30s
};

const queryLog = (debug: boolean | undefined, ...args: unknown[]) => {
    if (debug) {
        console.log(...args);
    }
};
queryLog.error = (debug: boolean, ...args: unknown[]) => {
    if (debug) {
        console.error(...args);
    }
};
export { queryLog }

