import type { AnyAtomGenerics, AtomStateFactory } from "@zedux/react";

export interface QueryAtomOptions<TData = unknown, TError = Error> {
    /** Required: Time in milliseconds until the atom instance is garbage collected. */
    ttl: number;
    /** Optional: Time in milliseconds until the data is considered stale. Defaults to 0. */
    staleTime?: number;
    /** Optional: Callback fired on successful fetch. Can override the returned data. */
    onSuccess?: ((data: TData) => TData) | ((data: TData) => Promise<TData>) | ((data: TData) => void) | ((data: TData) => Promise<void>);
    /** Optional: Callback fired on fetch error. Can override the error. */
    onError?: ((error: TError) => void) | ((error: TError) => Promise<void>) | ((error: TError) => void) | ((error: TError) => Promise<void>);
    /** Optional: Callback fired after fetch finishes (success or error). */
    onSettled?: ((data?: TData, error?: TError) => void) | ((data?: TData, error?: TError) => Promise<void>)
    /** Optional: If true, refetch on mount if data is stale. Defaults to true. */
    refetchOnMount?: boolean;
    /** Optional: If true, refetch on window focus if data is stale. Defaults to true. */
    refetchOnFocus?: boolean;
    /** Optional: Number of retries or a function to determine if retry should occur. Defaults to 0. */
    retry?: number | boolean | ((failureCount: number, error: TError) => boolean);
    /** Optional: Delay in ms between retries, or a function to calculate delay. Defaults to exponential backoff. */
    retryDelay?: number | ((attemptIndex: number) => number);
    /** Optional: If true, refetch on reconnect if data is stale. Defaults to true. */
    refetchOnReconnect?: boolean;
    /** Optional: If set to a number, refetch the query at this frequency in milliseconds. Defaults to false. */
    refetchInterval?: number | false;
    /** Optional: If true, refetch query in background even if window is not focused. Defaults to false. */
    refetchIntervalInBackground?: boolean;
    /** Optional: If false, the query will not run automatically. Defaults to true. */
    enabled?: boolean;
    /** Optional: If true, synchronize query state across tabs using BroadcastChannel. Defaults to true. */
    broadcast?: boolean;
    /** Optional: Set to true to enable suspense behavior. Defaults to false. */
    suspense?: boolean;
    /** Optional: If true, errors will be thrown during the render phase, otherwise they will be stored in the error state. Defaults to false, but true if suspense is enabled. */
    throwOnError?: boolean;
    /** Optional: If true, the query will not be fetched until fetch() is called. Defaults to false. */
    lazy?: boolean;
    /** Optional: If true, will print debug logs. Defaults to false. */
    debug?: boolean;
    /** Optional: Maximum number of retries. Defaults to 3. */
    maxRetries?: number;
    /** Optional: If true, will use SWR caching. Defaults to false. */
    swr?: boolean;
}
export type TQueryStatus = "error" | "success" | "idle" | "fetching";
export interface QueryState<TData = unknown, TError = Error> {
    data: TData | undefined;
    isIdle: boolean;
    isFetching: boolean;
    isSuccess: boolean;
    isError: boolean;
    status: TQueryStatus;
    lastUpdated: number | null;
}

export type PromiseMeta = {
    lastUpdated: number | null;
};
export type TQueryFn<TData> = () => Promise<TData>;
export type QueryFactoryTemplate<
    TData,
    TParams extends unknown[] = [],
    G extends AnyAtomGenerics<{
        Params: TParams;
        State: {
            enabled: boolean;
            queryFn: TQueryFn<TData>;
        } | TQueryFn<TData>;
        Signal: undefined;
    }> = AnyAtomGenerics<{
        Params: TParams;
        State: {
            enabled: boolean;
            queryFn: TQueryFn<TData>;
        } | TQueryFn<TData>;
        Signal: undefined;
    }>,
> = AtomStateFactory<G>;
