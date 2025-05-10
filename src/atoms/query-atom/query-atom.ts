import {
    atom,
    api,
    injectAtomValue,
    getDefaultEcosystem,
    injectEcosystem,
} from "@zedux/react";

import type { QueryFactoryTemplate, QueryAtomOptions } from "./_types";
import { injectQuery } from "./injectors/inject-query";
import { queryConfigAtom } from "./config-atom";
import { queryLog } from "./_utils"; // Import queryLog


export const queryAtom = <
    TData = unknown,
    TError = Error,
    TQueryKey extends string = string,
    TAtomParams extends unknown[] = [], // Parameters the user's factory is called with
    TCombinedParams extends unknown[] = [], // Parameters TQueryDef will contain, and options are keyed by
>(
    key: TQueryKey,
    // User's factory: called with TAtomParams, returns TQueryDef with TCombinedParams
    queryTemplate: QueryFactoryTemplate<TData, TAtomParams, TCombinedParams>,
    // Options are generic over TCombinedParams
    options?: QueryAtomOptions<TData, TError, TCombinedParams>
) => {

    const ttl = options?.ttl || 1000 // todo
    // The inner factory is called with TAtomParams
    const factory = (...atomParams: TAtomParams) => {
        const configDefaults = injectAtomValue(queryConfigAtom)
        const {
            staleTime = configDefaults.staleTime,
            throwOnError: _throwOnError,
            enabled: enabledFromOptions = configDefaults.enabled,
            broadcast = configDefaults.broadcast,
            lazy = configDefaults.lazy,
            suspense = configDefaults.suspense, // Default suspense to false
            debug = configDefaults.debug,
            swr = configDefaults.swr,
            retry,
            serializeQueryParams,
            ...remainingOptions
        } = options || {};
        // If suspense is enabled, enabled must also be true, and errors should throw by default
        const throwOnError = suspense ? true : (_throwOnError ?? false);
        const maxRetries = typeof retry === "number" ? retry : retry === true ? configDefaults.maxRetries : 0; // Default retries
        const queryFnAtom = atom(`${key}-queryFn`, queryTemplate, {
            tags: ["unserializable"]
        })
        // loadedState is TQueryDef<TData, TCombinedParams>
        const loadedState = injectAtomValue(queryFnAtom, atomParams);
        const enabledFromFactory = loadedState.enabled
        const enabled = enabledFromOptions && enabledFromFactory;
        const shouldBeEnabled = (enabled && !lazy);

        // Determine the cacheKey
        let cacheKeyToUse: string;
        if (serializeQueryParams) {
            cacheKeyToUse = `${key}::${serializeQueryParams(loadedState)}`; // 'key' here is the baseKey
        } else {
            // Default serialization: baseKey + stringified TQueryDef.params
            try {
                // Ensure a stable stringification if params can be complex objects.
                // For simple arrays of primitives, JSON.stringify is often okay.
                cacheKeyToUse = `${key}::${JSON.stringify(loadedState.params)}`;
            } catch (e) {
                queryLog(true, `Query ${key}: Failed to stringify query params for cache key. Using baseKey only. Error:`, e);
                cacheKeyToUse = key; // Fallback, less ideal, but ensures a key exists
            }
        }

        // injectQuery is generic over TCombinedParams.
        // `options` (and thus `remainingOptions`) is already QueryAtomOptions<..., TCombinedParams>
        // `loadedState` contains TCombinedParams in its .params property.
        const qapi = injectQuery<TData, TError, TCombinedParams>(
            key,
            cacheKeyToUse,
            loadedState,
            {
                lazy,
                suspense,
                swr,
                staleTime,
                retry,
                maxRetries,
                throwOnError,
                enabled: shouldBeEnabled,
                ttl,
                debug,
                ...remainingOptions
            }
        );

        return qapi
    };
    return atom(key, factory, {
        ttl,
    });
};
