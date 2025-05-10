import { api as zeduxApi, type AtomApi } from '@zedux/react';
// Assuming TQueryFn will be exported from _types.ts
import { QUERY_DEF_BRAND, type TQueryDef, type TQueryFn } from './_types';


export type ConfiguredQueryExecutor<TData, TParams extends unknown[]> = AtomApi<{
    State: TQueryDef<TData, TParams>;
    Exports: Record<string, unknown>;
    Promise: undefined; // The AtomApi itself doesn't resolve a promise directly
    Signal: undefined; // No signals used at this AtomApi level
}>;

export const queryExecutor = <TData, TParams extends unknown[]>(
    fetcher: (...args: TParams) => Promise<TData>,
    params: TParams,
    enabled = true
): ConfiguredQueryExecutor<TData, TParams> => {
    const actualQueryFn: TQueryFn<TData> = () => fetcher(...params);

    const apiInstance = zeduxApi({
        enabled,
        queryFn: actualQueryFn,
        params,
        __brand: QUERY_DEF_BRAND
    })

    return apiInstance;
};
