import { type AtomApi, injectAtomValue, api as zeduxApi } from "@zedux/react";
import { GenericEventMap } from "./_types";
import { authAtom } from "../auth-atom";
import { AUTHENTICATED_QUERY_TAG } from "./_utils";
import { QUERY_DEF_BRAND, type TQueryDef, type TQueryFn } from "./_types";

export type ConfiguredQueryExecutor<
  TData,
  TParams extends unknown[],
> = AtomApi<{
  State: TQueryDef<TData, TParams>;
  Exports: GenericEventMap;
  Promise: undefined; // The AtomApi itself doesn't resolve a promise directly
  Signal: undefined; // No signals used at this AtomApi level
}>;

export const queryExecutor = <TData, TParams extends unknown[]>(
  fetcher: (...args: TParams) => Promise<TData>,
  params: TParams,
  enabled = true,
  tags: string[] = [],
): ConfiguredQueryExecutor<TData, TParams> => {
  const actualQueryFn: TQueryFn<TData> = () => fetcher(...params);
  return zeduxApi({
    enabled,
    queryFn: actualQueryFn,
    params,
    __brand: QUERY_DEF_BRAND,
    tags,
  });
};

export const authedQueryExecutor = <TData, TParams extends unknown[]>(
  fetcher: (...args: TParams) => Promise<TData>,
  params: TParams,
  enabled = true,
  tags: string[] = [],
): ConfiguredQueryExecutor<TData, TParams> => {
  const authToken = injectAtomValue(authAtom);
  const enabledCondition = enabled && !!authToken;
  return queryExecutor(fetcher, params, enabledCondition, [
    AUTHENTICATED_QUERY_TAG,
    ...tags,
  ]);
};
