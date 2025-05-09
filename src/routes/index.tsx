import { createFileRoute } from "@tanstack/react-router";
import { useId } from "react";
import {
  preloadedQueryAtom,
  QueryPlayground,
  // QueryPlayground,
} from "~/components/QueryPlayground";

export const Route = createFileRoute("/")({
  component: QueryPlayground,
  // loader: async (ctx) => {
  //   const queryAtomInstance =
  //     ctx.context.rootEcosystem.getNodeOnce(preloadedQueryAtom);
  //   console.log("start loader promise");
  //   return {
  //     deferredPromise: queryAtomInstance.promise
  //   }
  // },
});
