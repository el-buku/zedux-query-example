import { createFileRoute } from "@tanstack/react-router";
import { useId } from "react";
import {
  preloadedQueryAtom,
  QueryPlayground,
} from "~/components/QueryPlayground";

export const Route = createFileRoute("/")({
  component: QueryPlayground,
});
