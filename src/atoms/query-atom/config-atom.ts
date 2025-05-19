import { atom } from "@zedux/react";
import { BASE_CONFIG_DEFAULTS } from "./_utils";

export const queryConfigAtom = atom(
  "query-config-defaults",
  BASE_CONFIG_DEFAULTS,
);
