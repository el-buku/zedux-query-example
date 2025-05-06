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
import { createQueryAtom } from "~/atoms/query-atom/query-atom";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface QueryDisplayProps {
  title: string;
  buttons: React.ReactNode;
  children: React.ReactNode;
}

const QueryDisplay: React.FC<QueryDisplayProps> = ({ title, buttons, children }) => {
  return (
    <div className="w-[30rem] h-[30rem] flex flex-col">
      <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
      <span className="text-white text-11 font-book block w-full whitespace-break-spaces break-words">
        {children}
      </span>
      <div className="flex gap-4 mt-8">{buttons}</div>
    </div>
  );
};

export const doSimpleFetch = async (id: string) => {
  await wait(3330);
  const response = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${id}`
  );
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json() as Promise<{ title: string }>;
};

const simpleQueryAtomWithParamsFromReact = createQueryAtom(
  "simple-query",
  (id: string) => {
    return () => doSimpleFetch(id);
  },
  {
    lazy: false,
    ttl: 0,
    // refetchInterval: 10500,
    debug: true,
    suspense: true,
  }
);
const simpleQueryAtomWithParamsFromReactNoSuspense = createQueryAtom(
  "simple-query-no-suspense",
  (id: string) => {
    return () => doSimpleFetch(id);
  },
  {
    lazy: false,
    ttl: 0,
    // refetchInterval: 10500,
    debug: true,
    swr:false,
    suspense: false,
  }
);

const simpleQueryAtomUsingAtomStateFactory = createQueryAtom(
  "simple-query-using-atom-state-factory",
  () => {
    const id = injectAtomValue(postIdAtom);
    const fetchFn = () => doSimpleFetch(id.toString());
    return api(fetchFn);
  },
  {
    lazy: false,
    ttl: 1000 * 60 * 60 * 24,
  }
);

const simpleLazyQueryAtom = createQueryAtom(
  "simple-lazy-query",
  () => () => doSimpleFetch("1"),
  {
    lazy: true,
    suspense: false,
    ttl: 1000 * 60 * 60 * 24,
    debug: true,
  }
);

const postIdAtom = atom<number>("postId", 1);

const SimpleQuery = () => {
  const [id, setId] = useState(1);
  const [data, expos] = useAtomState(simpleQueryAtomWithParamsFromReact, [
    id.toString(),
  ]);
  console.log('simpleQuery', data)

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

// const LoaderData = () => {
//   const data = Route.useLoaderData();
//   console.log("loaderData", data);
//   return (
//     <div className="w-[30rem] h-[30rem] flex flex-col">
//       <h2 className="text-xl font-semibold text-white mb-3">
//         Router Loader Data Query
//       </h2>

//       <span className="mt-auto text-white text-11 font-book block w-[10rem]">
//         {JSON.stringify(data)}
//       </span>
//     </div>
//   );
// };

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

        {/* <Suspense fallback={<div>Loading SimpleLazyQuery...</div>}>
          <LoaderData />
        </Suspense> */}
      </div>
    </div>
  );
};
