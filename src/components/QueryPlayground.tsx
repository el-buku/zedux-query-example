import {
  api,
  atom,
  injectAtomValue,
  injectMemo,
  useAtomInstance,
  useAtomState,
  useAtomValue,
  useEcosystem,
} from "@zedux/react";
import { Suspense, useEffect, useId, useState } from "react";
import { Button } from "./button";
import { queryAtom } from "~/atoms/query-atom/query-atom";
import { queryExecutor } from "~/atoms/query-atom/query-executor";
import { Route } from "~/routes/index";
import { QueryDisplay } from "./QueryDisplay";
import { Await } from "@tanstack/react-router";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const doSimpleFetch = async (id: string) => {
  await wait(100);
  const response = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${id}`
  );
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json() as Promise<{ title: string }>;
};


const simpleQueryAtomWithParamsFromReact = queryAtom(
  "simple-query",
  (id: string) => {
    return queryExecutor(doSimpleFetch, [id]);
  },
  {
    lazy: false,
    ttl: 0 * 10,
    staleTime: 0,
    refetchInterval: 20000,
    debug: false,
    suspense: false,
    swr: true,
  }
);
const simpleQueryAtomWithParamsFromReactNoSuspense = queryAtom(
  "simple-query-no-suspense",
  (id: string) => {
    return queryExecutor(doSimpleFetch, [id]);
  },
  {
    lazy: false,
    ttl: 1000 * 20,
    refetchInterval: 10500,
    debug: false,
    suspense: false,
  }
);

const simpleQueryAtomUsingAtomStateFactory = queryAtom(
  "simple-query-using-atom-state-factory",
  () => {
    const id = injectAtomValue(postIdAtom);
    return queryExecutor(doSimpleFetch, [id.toString()]);
  },
  {
    lazy: false,
    debug: false,
    ttl: 1000 * 60 * 60 * 24,
    suspense: true,
  }
);

const simpleLazyQueryAtom = queryAtom(
  "simple-lazy-query",
  () => queryExecutor(doSimpleFetch, ["1"]),
  {
    lazy: true,
    suspense: false,
    ttl: 1000 * 60 * 60 * 24,
    debug: false,
  }
);

const listOfShit = new Array(100).fill(0).map((_, i) => i);

const queryAtomWithCombinedParams = queryAtom(
  "query-atom-with-combined-params",
  (id: number) => {
    const idFromFactory = injectAtomValue(postIdAtom);
    const simpleFetchWithCombinedIds = async (
      id: number,
      idFromFactory: number
    ) => {
      await wait(100);
      return {
        text: "id: " + id + " idFromFactory: " + idFromFactory,
      };
    };
    return queryExecutor(simpleFetchWithCombinedIds, [id, idFromFactory]);
  },
  {
    lazy: false,
    swr: false,
    ttl: 2000,
    staleTime: 2000,
    debug: true,
    suspense: false,
  }
);

const queryAtomWithLifecycleHooks = queryAtom(
  "query-atom-with-lifecycle-hooks",
  (id: number) => {
    return queryExecutor(doSimpleFetch, [id.toString()]);
  },
  {
    debug: false,
    ttl: 2000,
    staleTime: 2000,
    suspense: false,
    onQueryStarted: async (params, queryFulfilled) => {
      console.log("queryAtomWithLifecycleHooks:onQueryStarted", params);
      const fulfilled = await queryFulfilled;
      console.log("queryAtomWithLifecycleHooks:queryFulfilled", fulfilled);
    },
    onCacheEntryAdded: async (params, cacheDataLoaded, cacheDataRemoved) => {
      console.log("queryAtomWithLifecycleHooks:onCacheEntryAdded", params);
      const loaded = await cacheDataLoaded;
      console.log("queryAtomWithLifecycleHooks:cacheDataLoaded", loaded);
      const removed = await cacheDataRemoved;
      console.log("queryAtomWithLifecycleHooks:cacheDataRemoved", removed);
    },
    onSuccess: (data) => {
      console.log("queryAtomWithLifecycleHooks:onSuccess", data);
    },
    onError: (error) => {
      console.log("queryAtomWithLifecycleHooks:onError", error);
    },
  }
);

const queryAtomWithPaginationAndMerging = queryAtom(
  "query-atom-with-pagination-and-merging",
  (page: number, pageSize: number) => {
    const simulatedFetchList = async (page: number, pageSize: number) => {
      await wait(100);
      return listOfShit.slice(page * pageSize, page * pageSize + pageSize);
    };
    return queryExecutor(simulatedFetchList, [page, pageSize]);
  },
  {
    debug: false,
    ttl: 2000,
    staleTime: 2000,
    suspense: false,
    swr: true,
    serializeQueryParams: (queryDef) => {
      const [_page, _pageSize] = queryDef.params;
      return `::::${_pageSize}`;
    },
    merge: (prevData, newData, otherArgs) => {
      console.log(
        "merge",
        "newData:",
        newData,
        "crossParamPrevData:",
        prevData,
        "otherArgs:",
        otherArgs
      );
      const newMergedData = [...(prevData?.data ?? []), ...newData];
      console.log("newMergedData", newMergedData);
      return newMergedData;
    },
  }
);

const postIdAtom = atom<number>("postId", 5);

const SimpleQuery = () => {
  const [id, setId] = useState(1);
  const [data, expos] = useAtomState(simpleQueryAtomWithParamsFromReact, [
    id.toString(),
  ]);

  return (
    <QueryDisplay
      title={`SimpleQuery - postId: ${id}`}
      buttons={
        <>
          <Button onClick={() => expos.fetch()}>Fetch</Button>
          <Button onClick={() => expos.invalidate()}>Invalidate</Button>
          <Button onClick={() => setId(id + 1)}>Increment ID</Button>
          <Button onClick={() => setId(id - 1)}>Decrement ID</Button>
        </>
      }
    >
      {data.status} -{JSON.stringify(data?.data)}
    </QueryDisplay>
  );
};
const SimpleQueryNoSuspense = () => {
  const [id, setId] = useState(2);
  const [data, expos] = useAtomState(
    simpleQueryAtomWithParamsFromReactNoSuspense,
    [id.toString()],
    {
      suspend: false,
    }
  );

  return (
    <QueryDisplay
      title={`SimpleQueryNoSuspense - postId: ${id}`}
      buttons={
        <>
          <Button onClick={() => expos.fetch()}>Fetch</Button>
          <Button onClick={() => expos.invalidate()}>Invalidate</Button>
          <Button onClick={() => setId(id + 1)}>Increment ID</Button>
          <Button onClick={() => setId(id - 1)}>Decrement ID</Button>
        </>
      }
    >
      {data.status} -{JSON.stringify(data?.data)}
    </QueryDisplay>
  );
};
const SimpleQueryReusingAtom = () => {
  const [id, setId] = useState(3);
  const [data, expos] = useAtomState(simpleQueryAtomWithParamsFromReact, [
    id.toString(),
  ]);
  return (
    <QueryDisplay
      title={`SimpleQueryReusingAtom - postId: ${id}`}
      buttons={
        <>
          <Button onClick={() => expos.fetch()}>Fetch</Button>
          <Button onClick={() => expos.invalidate()}>Invalidate</Button>
          <Button onClick={() => setId(id + 1)}>Increment ID</Button>
          <Button onClick={() => setId(id - 1)}>Decrement ID</Button>
        </>
      }
    >
      {data.status} -{JSON.stringify(data?.data)}
    </QueryDisplay>
  );
};

const SimpleLazyQuery = () => {
  const [data, expos] = useAtomState(simpleLazyQueryAtom);
  return (
    <QueryDisplay
      title="SimpleLazyQuery"
      buttons={
        <>
          <Button onClick={() => expos.fetch()}>Fetch</Button>
          <Button onClick={() => expos.invalidate()}>Invalidate</Button>
        </>
      }
    >
      {data.status} -{JSON.stringify(data?.data)}
    </QueryDisplay>
  );
};

const SimpleQueryUsingAtomStateFactory = () => {
  const [id, setId] = useAtomState(postIdAtom);
  const [data, expos] = useAtomState(simpleQueryAtomUsingAtomStateFactory);

  return (
    <QueryDisplay
      title={`SimpleQueryUsingAtomStateFactory - postId: ${id}`}
      buttons={
        <>
          <Button onClick={() => expos.fetch()}>Fetch</Button>
          <Button onClick={() => expos.invalidate()}>Invalidate</Button>
          <Button onClick={() => setId(id + 1)}>Increment ID</Button>
          <Button onClick={() => setId(id - 1)}>Decrement ID</Button>
        </>
      }
    >
      {data.status} -{JSON.stringify(data?.data)}
    </QueryDisplay>
  );
};

const SimpleQueryWithCombinedParams = () => {
  const [id, setId] = useState(3);
  const [data, expos] = useAtomState(queryAtomWithCombinedParams, [id]);
  return (
    <QueryDisplay
      title={`SimpleQueryWithCombinedParams - postId: ${id}`}
      buttons={
        <>
          <Button onClick={() => expos.fetch()}>Fetch</Button>
          <Button onClick={() => expos.invalidate()}>Invalidate</Button>
          <Button onClick={() => setId(id + 1)}>Increment ID</Button>
          <Button onClick={() => setId(id - 1)}>Decrement ID</Button>
        </>
      }
    >
      {data.status} -{JSON.stringify(data?.data)}
    </QueryDisplay>
  );
};

const SimpleQueryWithLifecycleHooks = () => {
  const [id, setId] = useState(7);
  const [{ status, data }, expos] = useAtomState(queryAtomWithLifecycleHooks, [id]);
  return (
    <QueryDisplay
      title="SimpleQueryWithLifecycleHooks"
      buttons={
        <>
          <Button onClick={() => expos.fetch()}>Fetch</Button>
          <Button onClick={() => expos.invalidate()}>Invalidate</Button>
          <Button onClick={() => setId(id + 1)}>Increment ID</Button>
          <Button onClick={() => setId(id - 1)}>Decrement ID</Button>
        </>
      }
    >
      {status} -{JSON.stringify(data)}
    </QueryDisplay>
  );
};

const SimpleQueryWithPaginationAndMerging = () => {
  const [id, setId] = useState(1);
  const pageSize = 10;
  const [{ status, data }, expos] = useAtomState(queryAtomWithPaginationAndMerging, [id, pageSize]);
  return (
    <QueryDisplay
      title="SimpleQueryWithPaginationAndMerging"
      buttons={
        <>
          <Button onClick={() => expos.fetch()}>Fetch Next Page</Button>
          <Button onClick={() => expos.invalidate()}>Invalidate</Button>
          <Button onClick={() => setId(id + 1)}>Next Page (id++)</Button>
          {/* <Button onClick={() => setId(0)}>Reset Page to 0</Button> */}
        </>
      }
    >
      {status} - Loaded {data?.length || 0} items - {JSON.stringify(data)}
    </QueryDisplay>
  );
};


export const QueryPlayground = () => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prevSeconds) => prevSeconds + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex flex-col h-screen w-full mt-8">
      <h1 className="text-2xl font-semibold text-white mb-4 px-4 md:px-8 pt-4 flex-shrink-0">
        Query Playground - {seconds} seconds passed
      </h1>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(30rem,1fr))] grid-auto-rows-[30rem] gap-7 w-full p-8">
          <Suspense fallback={<div>Loading SimpleQuery...</div>}>
            <SimpleQuery />
          </Suspense>

          <Suspense fallback={<div>Loading SimpleQueryNoSuspense...</div>}>
            <SimpleQueryNoSuspense />
          </Suspense>
          <Suspense fallback={<div>Loading SimpleQueryReusingAtom...</div>}>
            <SimpleQueryReusingAtom />
          </Suspense>
          <Suspense
            fallback={<div>Loading SimpleQueryUsingAtomStateFactory...</div>}
          >
            <SimpleQueryUsingAtomStateFactory />
          </Suspense>
          <Suspense fallback={<div>Loading SimpleLazyQuery...</div>}>
            <SimpleLazyQuery />
          </Suspense>

          <Suspense
            fallback={<div>Loading SimpleQueryWithCombinedParams...</div>}
          >
            <SimpleQueryWithCombinedParams />
          </Suspense>
          <Suspense fallback={<div>Loading SimpleQueryWithLifecycleHooks...</div>}>
            <SimpleQueryWithLifecycleHooks />
          </Suspense>
          <Suspense fallback={<div>Loading SimpleQueryWithPaginationAndMerging...</div>}>
            <SimpleQueryWithPaginationAndMerging />
          </Suspense>
        </div>
      {/* <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-4">
      </div> */}
    </div>
  );
};
