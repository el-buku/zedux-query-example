import {
    atom,
    api,
    injectAtomValue,
} from "@zedux/react";

import type { QueryFactoryTemplate, QueryAtomOptions } from "./_types";
import { injectQuery } from "./injectors/inject-query";
import { CONFIG_DEFAULTS } from "./_utils";


export const createQueryAtom = <
    TData = unknown,
    TError = Error,
    TQueryKey extends string = string,
    TParams extends unknown[] = [],
>(
    key: TQueryKey,
    queryTemplate: QueryFactoryTemplate<TData, TParams>,
    options?: QueryAtomOptions<TData, TError>
) => {
    const {
        ttl,
        staleTime = CONFIG_DEFAULTS.staleTime,
        onSuccess,
        onError,
        onSettled,
        refetchOnMount,
        refetchOnFocus,
        retry,
        retryDelay,
        refetchOnReconnect,
        refetchInterval,
        refetchIntervalInBackground,
        initialData,
        throwOnError: _throwOnError,
        enabled: enabledFromOptions = CONFIG_DEFAULTS.enabled,
        broadcast = CONFIG_DEFAULTS.broadcast,
        lazy = CONFIG_DEFAULTS.lazy,
        suspense = CONFIG_DEFAULTS.suspense, // Default suspense to false
        debug = CONFIG_DEFAULTS.debug,
        swr = CONFIG_DEFAULTS.swr,
    } = options || {};
    // If suspense is enabled, enabled must also be true, and errors should throw by default
    const throwOnError = suspense ? true : (_throwOnError ?? false);
    const maxRetries = typeof retry === "number" ? retry : retry === true ? CONFIG_DEFAULTS.maxRetries : 0; // Default retries
    const queryFnAtom = atom(`${key}-queryFn`, queryTemplate)
    const factory = (...params: TParams) => {
        const loadedState = injectAtomValue(queryFnAtom, params);
        const queryFn = typeof loadedState === "function" ? loadedState : loadedState.queryFn;
        const enabledFromFactory = typeof loadedState === "object" ? loadedState.enabled : true; // enabled from factory allows for dependent queries
        const enabled = enabledFromOptions && enabledFromFactory;
        const shouldBeEnabled = (enabled && !lazy);
        const qapi = injectQuery<TData, TError>(key, queryFn, {
            lazy,
            suspense,
            swr,
            staleTime,
            initialData,
            refetchOnMount,
            refetchOnFocus,
            refetchOnReconnect,
            refetchIntervalInBackground,
            refetchInterval,
            broadcast,
            onSuccess,
            onError,
            onSettled,
            retry,
            retryDelay,
            maxRetries,
            throwOnError,
            enabled: shouldBeEnabled,
            ttl: ttl ?? CONFIG_DEFAULTS.ttl,
            debug,
        });

        return qapi
    };
    return atom(key, factory, {
        ttl,
    });
};



