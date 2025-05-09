import {
    atom,
    api,
    injectAtomValue,
    getDefaultEcosystem,
} from "@zedux/react";

import type { QueryFactoryTemplate, QueryAtomOptions } from "./_types";
import { injectQuery } from "./injectors/inject-query";
import { queryConfigAtom } from "./config-atom";
import { rootEcosystem } from "../ecosystem";


export const queryAtom = <
    TData = unknown,
    TError = Error,
    TQueryKey extends string = string,
    TParams extends unknown[] = [],
>(
    key: TQueryKey,
    queryTemplate: QueryFactoryTemplate<TData, TParams>,
    options?: QueryAtomOptions<TData, TError>
) => {
    const eco = rootEcosystem
    console.log("eco", eco.dehydrate());
    const configDefaults = eco.getOnce(queryConfigAtom)
    const ttl = options?.ttl || configDefaults.ttl
    const factory = (...params: TParams) => {
        const {
            staleTime = configDefaults.staleTime,
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
            enabled: enabledFromOptions = configDefaults.enabled,
            broadcast = configDefaults.broadcast,
            lazy = configDefaults.lazy,
            suspense = configDefaults.suspense, // Default suspense to false
            debug = configDefaults.debug,
            swr = configDefaults.swr,
        } = options || {};
        console.log("rootEcosysteezm", rootEcosystem.dehydrate());
        // If suspense is enabled, enabled must also be true, and errors should throw by default
        const throwOnError = suspense ? true : (_throwOnError ?? false);
        const maxRetries = typeof retry === "number" ? retry : retry === true ? configDefaults.maxRetries : 0; // Default retries
        const queryFnAtom = atom(`${key}-queryFn`, queryTemplate)
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
            ttl,
            debug,
        });

        return qapi
    };
    return atom(key, factory, {
        ttl,
    });
};



