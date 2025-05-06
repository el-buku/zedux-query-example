import {
  api,
  atom,
  injectAtomValue,
  injectMemo,
  useAtomInstance,
  useAtomState,
  useAtomValue,
} from "@zedux/react";
import { Suspense, useEffect, useState } from "react";
import { Button } from "./button";
import { queryAtom } from "~/atoms/query-atom/query-atom";
import { Route } from "~/routes/index";
import { doSimpleFetch } from "~/lib/do-fetch";
import { QueryDisplay } from "./QueryDisplay";
import { Await } from "@tanstack/react-router";

export const preloadedQueryAtom = queryAtom(
  "preloaded-query",
  () => () => doSimpleFetch("5"),
  {
    lazy: false,
    ttl: 60 * 1000,
    staleTime: 60 * 1000,
    // refetchInterval: 10500,
    debug: true,
    suspense: true,
  }
);

const simpleQueryAtomWithParamsFromReact = queryAtom(
  "simple-query",
  (id: string) => {
    return () => doSimpleFetch(id);
  },
  {
    lazy: false,
    ttl: 0,
    // refetchInterval: 10500,
    debug: false,
    suspense: true,
    swr: false,
    staleTime: 60 * 1000,
  }
);
const simpleQueryAtomWithParamsFromReactNoSuspense = queryAtom(
  "simple-query-no-suspense",
  (id: string) => {
    return () => doSimpleFetch(id);
  },
  {
    lazy: false,
    ttl: 0,
    // refetchInterval: 10500,
    debug: false,
    swr: false,
    suspense: false,
  }
);

const simpleQueryAtomUsingAtomStateFactory = queryAtom(
  "simple-query-using-atom-state-factory",
  () => {
    const id = injectAtomValue(postIdAtom);
    const fetchFn = () => doSimpleFetch(id.toString());
    return api(fetchFn);
  },
  {
    lazy: false,
    debug: false,
    ttl: 1000 * 60 * 60 * 24,
  }
);

const simpleLazyQueryAtom = queryAtom(
  "simple-lazy-query",
  () => () => doSimpleFetch("1"),
  {
    lazy: true,
    suspense: false,
    ttl: 1000 * 60 * 60 * 24,
    debug: false,
  }
);

const postIdAtom = atom<number>("postId", 1);

const SimpleQuery = () => {
  const [id, setId] = useState(1);
  const [data, expos] = useAtomState(simpleQueryAtomWithParamsFromReact, [
    id.toString(),
  ]);
  console.log("simpleQuery", data);

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
      {JSON.stringify(data)}
    </QueryDisplay>
  );
};
const SimpleQueryNoSuspense = () => {
  const [id, setId] = useState(1);
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
      {JSON.stringify(data)}
    </QueryDisplay>
  );
};
const SimpleQueryReusingAtom = () => {
  const [id, setId] = useState(1);
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
      {JSON.stringify(data)}
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
      {JSON.stringify(data)}
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
      {JSON.stringify(data)}
    </QueryDisplay>
  );
};

const LoaderData = () => {
 const [data, expos] = useAtomState(preloadedQueryAtom)
  return (
    <div className="w-[30rem] h-[30rem] flex flex-col">
      <h2 className="text-xl font-semibold text-white mb-3">
        Router Loader Data Query
      </h2>

      <span className="mt-auto text-white text-11 font-book block w-[10rem]">
        {JSON.stringify(data)}
      </span>
    </div>
  );
};

const LoaderDataAwaiter = () => {
    const {deferredPromise}  = Route.useLoaderData()
    if(!deferredPromise){
        console.log('no deferredPromise')
        return null
    }
    return <Await promise={deferredPromise}>
        {() => {
            return <LoaderData />
        }}
    </Await>
};

export const QueryPlayground = () => {
  return (
    <div className="flex flex-col flex-wrap h-screen w-full gap-4 mt-8">
      <h1 className="text-2xl font-semibold text-white mb-6">
        Query Playground
      </h1>
      <div className="grid grid-cols-3 gap-7 justify-between w-full">
        <Suspense fallback={<div>Loading SimpleQuery...</div>}>
          <SimpleQuery />
        </Suspense>

        {/* // TODO: NO-SUSPENSE not working */}
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

        <Suspense fallback={<div>Loading LoaderDataStreaming...</div>}>
          <LoaderDataAwaiter />
        </Suspense>
      </div>
    </div>
  );
};
