import type {
  AnyAtomGenerics,
  AnyAtomInstance,
  AtomApiPromise,
  AtomStateFactory,
  Signal,
} from "@zedux/react";
export type GenericEventMap = Record<string, unknown>;

export type TQueryRetryOption<TError> =
  | number
  | boolean
  | ((failureCount: number, error: TError) => boolean)
  | undefined;

export type QueryAtomOptions<
  TQueryFnData = unknown,
  TFinalData = TQueryFnData,
  TError = Error,
  TCombinedParams extends unknown[] = [], // This will be the type for TQueryDef.params
> = {
  /** Required: Time in milliseconds until the atom instance is garbage collected. */
  ttl: number;
  /** Optional: Time in milliseconds until the data is considered stale. Defaults to 0. */
  staleTime?: number;
  /** Optional: If true, refetch on mount if data is stale. Defaults to true. */
  refetchOnMount?: boolean;
  /** Optional: If true, refetch on window focus if data is stale. Defaults to true. */
  refetchOnFocus?: boolean;
  /** Optional: Number of retries or a function to determine if retry should occur. Defaults to false. */
  retry?: TQueryRetryOption<TError>;
  /** Optional: Delay in ms between retries, or a function to calculate delay. Defaults to exponential backoff. */
  retryDelay?: number | ((attemptIndex: number) => number);
  /** Optional: Delay unit in ms between retries, or a function to calculate delay. Defaults to 1000. */
  delayUnit?: number;
  /** Optional: Maximum delay in ms between retries. Defaults to 30000. */
  maxRetryDelay?: number;
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
  /** Optional: Initial data to set when the query is first created. Defaults to undefined. */
  initialData?: TFinalData | (() => TFinalData);
  /**
   * Optional: A function that takes the query parameters and the base query key,
   * and returns a serialized string to be used as the cache key.
   * This is useful for scenarios like infinite scrolling where some arguments
   * (e.g., page number) should not differentiate cache entries for merging.
   * Defaults to JSON.stringify of params appended to the base key if not provided.
   */
  serializeQueryParams?: (
    queryDef: TQueryDef<TQueryFnData, TCombinedParams>,
  ) => string;
  /** Optional: Tags to be used for caching/invalidation. Defaults to an empty array. Optionally can be a function that receives the current params */
  tags?: string[] | ((params: TCombinedParams) => string[]);

  /** Optional: If true, the query will be persisted in the localStorage/IDB(todo). Defaults to false. */
  persist?: boolean;
} & QueryAtomLifecycleOptions<
  TQueryFnData,
  TFinalData,
  TError,
  TCombinedParams
>; // Options are keyed by TCombinedParams

export type QueryAtomLifecycleOptions<
  TQueryFnData = unknown,
  TFinalData = TQueryFnData,
  TError = Error,
  TCombinedParams extends unknown[] = [],
> = QueryAtomLifecycleCallbacks<
  TQueryFnData,
  TFinalData,
  TError,
  TCombinedParams
> &
  QueryAtomLifecycleHooks<TFinalData, TCombinedParams>;

// Callbacks are fired synchronously during the lifecycle of the query, may be fired during the server render
export type QueryAtomLifecycleCallbacks<
  TQueryFnData = unknown,
  TFinalData = TQueryFnData,
  TError = Error,
  TCombinedParams extends unknown[] = [],
> = {
  /** Optional: Callback fired on successful fetch. Can override the returned data. */
  onSuccess?:
  | ((data: TQueryFnData, params: TCombinedParams) => TFinalData)
  | ((data: TQueryFnData, params: TCombinedParams) => Promise<TFinalData>)
  | ((data: TQueryFnData, params: TCombinedParams) => void) // Indicates TFinalData is TQueryFnData
  | ((data: TQueryFnData, params: TCombinedParams) => Promise<void>); // Indicates TFinalData is TQueryFnData
  /** Optional: Callback fired on fetch error. Can override the error. */
  onError?:
  | ((error: TError, params: TCombinedParams) => void)
  | ((error: TError, params: TCombinedParams) => Promise<void>)
  | ((error: TError, params: TCombinedParams) => void) // This seems to be a duplicate, perhaps meant TError | Promise<TError>? Keeping as is for now.
  | ((error: TError, params: TCombinedParams) => Promise<void>);
  /** Optional: Callback fired after fetch finishes (success or error). */
  onSettled?:
  | ((data?: TFinalData, error?: TError, params?: TCombinedParams) => void)
  | ((
    data?: TFinalData,
    error?: TError,
    params?: TCombinedParams,
  ) => Promise<void>);
  /**
   * Optional: Merges new data with existing data.
   * @param currentParamPrevData Previous data fetched with the *current* set of parameters.
   * @param newData The newly fetched data.
   * @param crossParamPrevData Data from the *absolute last successful fetch* for this query key,
   *                           regardless of parameters. Includes its original params and timestamp.
   * @param otherArgs Additional arguments like current params and timestamp.
   * @returns The merged data.
   */
  merge?: (
    prevData: CachedQueryEntry<TFinalData, unknown[]> | undefined,
    newData: TFinalData,
    otherArgs: {
      params: TCombinedParams; // Current params for this fetch
      fulfilledTimestamp: number;
    },
  ) => TFinalData;
};

// Hooks are fired asynchronously during the lifecycle, on the client only
export type QueryAtomLifecycleHooks<
  TFinalData = unknown, // Changed from TData to TFinalData
  TCombinedParams extends unknown[] = [], // onQueryStarted receives TCombinedParams
> = {
  /** Optional: Callback fired when the query is started.
   *
   * Note: This hook is only called on the client.
   */
  onQueryStarted?: (
    params: TCombinedParams, // onQueryStarted receives the TCombinedParams
    /**
     * A Promise that resolves when the query is successfully fetched and the data is stored in the cache.
     * This allows you to await until the query is fully resolved and data is available in the cache.
     * This fires after all the callbacks (onSuccess, merge, onSettled) have been called.
     */
    queryFulfilled: Promise<TQueryDataSignal<TFinalData>>,
  ) => Promise<void>;
  /**
   * Optional: Callback fired when a new cache entry is created for a given query key and its parameters.
   * This hook is useful for performing side effects when a specific query instance (differentiated by its parameters)
   * is first initialized in the cache. It provides promises to react to the lifecycle of this specific cache entry.
   *
   * Note: This hook is only called on the client.
   */
  onCacheEntryAdded?: (
    /** The parameters associated with this specific cache entry. */
    params: TCombinedParams,
    /**
     * A Promise that resolves with the first data signal (`TQueryDataSignal<TFinalData>`) successfully fetched and stored for this cache key.
     * This allows you to await until an actual value is available in the cache for this specific query instance.
     *
     * If the cache entry is removed from the cache (e.g., due to TTL expiration after failing to fetch)
     * *before* any data has ever been successfully resolved for it, this `cacheDataLoaded` Promise will reject with an error:
     * `new Error('Promise never resolved before cacheEntryRemoved.')`.
     * This rejection is designed to prevent memory leaks from unfulfilled promises tied to removed cache entries.
     * You can re-throw this specific error or choose to ignore it.
     */
    cacheDataLoaded: Promise<TQueryDataSignal<TFinalData>>,
    /**
     * A Promise that resolves when this specific cache entry (identified by `serializeQueryParams`) is removed from the cache.
     * This can be due to manual invalidation, or the atom instance being garbage collected after TTL expiration.
     * This allows you to perform cleanup actions specific to this cache entry when it's no longer active.
     */
    cacheDataRemoved: Promise<void>,
  ) => Promise<void>;
};

// This interface will be used for entries in our cross-parameter cache
export interface CachedQueryEntry<
  TFinalData = unknown,
  TParams extends unknown[] = unknown[],
> {
  data: TFinalData;
  params: TParams; // The parameters that were used to fetch this data
  timestamp: number; // When this data was fetched
}

export type TQueryDataSignal<TFinalData = unknown> = Signal<{
  Events: GenericEventMap;
  State: TFinalData | undefined;
  ResolvedState: TFinalData | undefined;
}>;

export type TQueryStatus = "error" | "success" | "idle" | "fetching";
export interface QueryState<TFinalData = unknown, TError = Error> {
  data: TFinalData | undefined;
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

export const QUERY_DEF_BRAND = "TQueryDef" as const;
export type TQueryDef<TQueryFnData, TParams extends unknown[]> = {
  enabled: boolean;
  queryFn: TQueryFn<TQueryFnData>;
  params: TParams;
  tags: string[];
  __brand: typeof QUERY_DEF_BRAND;
};

export type TQueryFn<TQueryFnData> = () => Promise<TQueryFnData>;
export type QueryFactoryTemplate<
  TQueryFnData,
  TAtomParams extends unknown[] = [], // Parameters the atom factory function itself accepts
  TCombinedParams extends unknown[] = [], // Parameters that will be in TQueryDef.params
// For the user of queryAtom, their factory is `(...args: TAtomParams) => TQueryDef<TQueryFnData, TCombinedParams>`
> = AtomStateFactory<
  AnyAtomGenerics<{
    Params: TAtomParams; // The atom factory's own parameters
    State: TQueryDef<TQueryFnData, TCombinedParams>; // The state it produces contains TCombinedParams
    Signal: undefined; // Or a more specific signal type if applicable
    Exports: GenericEventMap; // No exports by default
    Promise: AtomApiPromise; // Required by AtomGenerics constraint
    InstanceType: AnyAtomInstance;
  }>
>;

export type TQueryControl<TFinalData> = {
  // Changed TData to TFinalData
  controller: AbortController | undefined;
  hasFetchedOnce: boolean;
  isRetry: boolean;
  retryTimeoutId: NodeJS.Timeout | null;
  failureCount: number;
  activeFetchPromise: Promise<TFinalData | undefined> | null; // Changed TData to TFinalData
};
