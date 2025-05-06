# Zedux Query Atom Implementation

This directory contains a custom query implementation built using Zedux V2 atoms and injectors, aiming to replicate core functionalities found in libraries like TanStack Query.

## Core Concepts

- **`createQueryAtom`:** The primary factory function used to create query atoms. It accepts a unique key, a query atom state factory template (which can optionally return an `{ enabled, queryFn }` object for dependent queries), and configuration options.
- **Atom Instances as Cache:** Each unique combination of the `key` passed to `createQueryAtom` and the `params` passed during atom instance creation represents a distinct cache entry. Zedux's ecosystem manages the lifecycle and garbage collection of these instances based on the `ttl` option.
- **Injectors:** Complex logic like state management, fetching, retries, and refetching is encapsulated within custom Zedux injectors (`injectQuery`, `injectQueryState`, `injectRefetch`).
- **State Machine:** Uses `@zedux/machines` (`injectQueryState`) to manage the query lifecycle (`idle`, `fetching`, `success`, `error`) explicitly.
- **Global Managers:** Singleton atoms (`onlineManagerAtom`, `broadcastChannelAtom`) handle global concerns like network status and cross-tab communication (though broadcast functionality is still WIP).

## Current Features

- **Declarative Query Definition:** Define queries using `createQueryAtom`.
- **Parameterized Queries:** Pass parameters to query atoms during instantiation.
- **Automatic Caching:** Handled by Zedux atom instance management.
- **Background Refetching:**
  - `refetchOnMount`: Refetches stale data when an atom instance mounts.
  - `refetchOnWindowFocus`: Refetches stale data when the window regains focus.
  - `refetchOnReconnect`: Refetches stale data when the network connection is restored.
- **Polling/Interval Refetching:**
  - `refetchInterval`: Refetches data at a specified interval.
  - `refetchIntervalInBackground`: Controls if interval refetching occurs when the window is not focused.
- **State Management:** Explicit state machine tracks `idle`, `fetching`, `success`, `error` states. Exposes boolean flags (`isIdle`, `isFetching`, `isSuccess`, `isError`, `isLoading`) and `status` string.
- **Retries:** Automatic retries on failure with configurable count (`retry`, `maxRetries`) and delay (`retryDelay`, including exponential backoff).
- **Stale Time Configuration:** `staleTime` option determines when data is considered stale.
- **Enabled/Disabled Queries:** Control query execution via the `enabled` option or dynamically via the `enabledFromFactory` pattern (returning `{ enabled, queryFn }`).
- **Lazy Queries:** `lazy` option prevents automatic fetching until `fetch()` is called.
- **Suspense Integration:** `suspense` option enables integration with React Suspense.
- **Error Handling:** `throwOnError` option controls whether errors are thrown or stored in state. Lifecycle callbacks (`onError`, `onSettled`).
- **Success Handling:** Lifecycle callbacks (`onSuccess`, `onSettled`). Callbacks can be async and `onSuccess` can potentially modify returned data.
- **Initial Data:** `initialData` option supports static values or functions to provide data before the first fetch.
- **Query Cancellation:** Exposes a `cancel()` method to abort in-flight requests using `AbortController`.
- **SWR Invalidation:** `swr` option preserves data during invalidation (`invalidate()`) while triggering a background refetch.
- **Debugging:** `debug` option enables debug logging.

## Feature Comparison: Zedux Query vs. TanStack Query Core

| Feature                              | TanStack Query Status                 | Zedux Query Status                                         | Notes / Gaps / Plan                                                                                                                       |
| :----------------------------------- | :------------------------------------ | :--------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **Caching Strategy**                 | Centralized `QueryCache`              | Decentralized (Atom Instances)                             | Functionally similar via ecosystem API.                                                                                                   |
| **Cache Key Strategy**               | Stable JSON Serialization             | String Key + Params (Reference Equality)                   | **Gap:** Potential misses with unstable object params. TODO: stable param serialization.                                                  |
| **Cache Change Detection**           | `queryHash` from Key                  | Atom Instance Identity (Key + Params)                      | Tied to Cache Key Strategy.                                                                                                               |
| **Data Change Detection**            | Deep Compare + **Structural Sharing** | Reference Equality                                         | **Gap:** **Structural Sharing Missing.** Critical for performance. TODO: Implement structural sharing before `dataSignal.set`.            |
| **Data Memoization**                 | Full Structural Sharing               | Relies on Reference Stability                              | **Gap:** Ineffective without Structural Sharing.                                                                                          |
| **Polling/Intervals**                | Yes                                   | Yes                                                        | `refetchInterval`, `refetchIntervalInBackground` options.                                                                                 |
| **Parallel Queries**                 | Yes (Implicit)                        | **Yes** (Implicitly via Zedux)                             |                                                                                                                                           |
| **Dependent Queries**                | Yes (`enabled` option)                | **Yes** (`enabled` option + `enabledFromFactory` pattern)  |                                                                                                                                           |
| **Paginated Queries**                | Yes (Often uses `keepPreviousData`)   | **Partially Implemented** (Requires `keepPreviousData`)    | _Gap:_ Lacks `keepPreviousData`. TODO: Implement `keepPreviousData`.                                                                      |
| **Infinite Queries**                 | Yes (`useInfiniteQuery`)              | **Missing**                                                | TODO                                                                                                                                      |
| **Bi-directional Infinite Queries**  | Yes (`getPreviousPageParam`)          | **Missing**                                                | TODO                                                                                                                                      |
| **Infinite Query Refetching**        | Yes                                   | **Missing**                                                | TODO                                                                                                                                      |
| **Lagged Query Data**                | Yes (`keepPreviousData`)              | **Missing**                                                | _Gap:_ Important UX feature. TODO Implement `keepPreviousData`.                                                                           |
| **Selectors (`select`)**             | Yes                                   | **PArtially Missing**                                      | Zedux has selectors, but query-atom should have another optional `select` param that memoizes and returns only the requested fields       |
| **Scroll Recovery**                  | Experimental (`useScrollRestorer`)    | **Out of Scope**                                           | UI concern.                                                                                                                               |
| **Cache Manipulation**               | `QueryClient` API                     | **Requires Utilities**                                     | _Gap:_ No direct client API. TODO Implement tag-based invalidation utility. Add others (`setQueryData`, `refetchQueriesByTag`) as needed. |
| **Outdated Query Dismissal**         | N/A (Handled by stale/GC)             | **N/A** (Handled by stale/TTL)                             |                                                                                                                                           |
| **Render Batching & Optimization**   | Batched Notifs + Field Tracking       | Batched Updates (Zedux) + Ref Equality                     | _Gap:_ **Structural Sharing Missing.** Field tracking possible TODO, can be achieved via zedux selectors.                                 |
| **Auto Garbage Collection**          | Yes (`gcTime`)                        | **Yes** (via Zedux `ttl`)                                  |                                                                                                                                           |
| **Mutation Hooks**                   | Yes (`useMutation`)                   | **Missing**                                                | Requires `createMutationAtom`. TODO                                                                                                       |
| **Offline Mutation Support**         | Yes (with persistence)                | **Missing**                                                | Requires `createMutationAtom` + persistence. Not planned for now                                                                          |
| **Optimistic Updates**               | Yes (`onMutate` context)              | **Missing**                                                | TODO Design mechanism (tag invalidation or direct update).                                                                                |
| **Automatic Refetch after Mutation** | Yes (often via invalidation)          | **Requires Manual Invalidation**                           | TODO Design mechanism for specifying tags to invalidate                                                                                   |
| **Prefetching APIs**                 | Yes (`prefetchQuery`)                 | **Requires Utility Function**                              | _Gap:_ No direct API. can use `atomInstance.exports.fetch` for now                                                                        |
| **Query Cancellation**               | Yes (`cancel` method)                 | **Yes** (Exposed `cancel` API)                             |                                                                                                                                           |
| **Partial Query Matching**           | Yes (Partial Keys/Predicates)         | **Partially Achievable (Tags)**                            | _Gap:_ No deep param matching. TODO Implement tag-based utility first.                                                                    |
| **Stale While Revalidate**           | Yes (Default)                         | **Yes** (Default + `swr` option for invalidation behavior) |                                                                                                                                           |
| **Stale Time Configuration**         | Yes (`staleTime`)                     | **Yes** (`staleTime` option)                               |                                                                                                                                           |
| **Pre-usage Query Configuration**    | Yes (`defaultOptions`)                | **Achievable via Composition**                             | TODO Use wrapper functions.                                                                                                               |
| **Window Focus Refetching**          | Yes (`refetchOnWindowFocus`)          | **Yes** (`refetchOnFocus` option)                          |                                                                                                                                           |
| **Network Status Refetching**        | Yes (`refetchOnReconnect`)            | **Yes** (`refetchOnReconnect` option)                      |                                                                                                                                           |
| **Cache Dehydration/Rehydration**    | Yes (`dehydrate`/`hydrate`)           | **Yes, Relies on Zedux**                                   |                                                                                                                                           |
| **Offline Caching**                  | Yes (with persistence)                | **Missing**                                                | Persistence not yet implemented, TODO                                                                                                     |
| **React Suspense**                   | Yes                                   | **Yes** (`suspense` option)                                |                                                                                                                                           |
| **`placeholderData`**                | Yes                                   | **Missing**                                                | TODO Implement handling in `injectQuery`.                                                                                                 |

## Roadmap / Missing Features (High Priority Gaps)

0.  **Stable Param Serialization** consistently hash params and query key, use params signal and use the hashed param for the promise deps instead of ref array or just use a cache atom and set/get as needed
1.  **Structural Sharing:** Implement deep comparison and structural sharing before setting data state to optimize performance and memoization. - can be achieved with `mutate`
2.  **Lagged Query Data (`keepPreviousData`):** Add support for retaining previous data while new data loads, needed for pagination and dependent query UX.
3.  **`placeholderData`:** Add support for displaying placeholder data during initial fetch.
4.  **Tag-Based Invalidation/Refetching Utility:** TODO.
5.  **Optimistic Updates Mechanism:** TODO - comprehensive tag management needed first
6.  **Cache Manipulation Utilities:** Maybe: should add helpers for `setQueryData`, `refetchQueriesByTag` etc., as needed.

## Deferred Features

- Full Mutation Implementation (`createMutationAtom`)
- Infinite Queries (`createInfiniteQueryAtom`)
- Selectors (`select` option)

## Fixes:

- Route loader streaming example fetches the data on the server and sends it back to the client. it is available if the promise returns data and the component renders it. however, when trying to actually rehydrate the atom from the streamed data, the atom is reconstructed rather than rehydrated. need to fix this
