import { createFileRoute } from "@tanstack/react-router";
import {
  QueryPlayground,
} from "~/components/QueryPlayground";

export const Route = createFileRoute("/")({
  component: QueryPlayground,
});
