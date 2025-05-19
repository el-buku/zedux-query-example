import { getRouterContext } from "@tanstack/react-router";
import {
    AnyAtomGenerics,
    AnyAtomInstance,
    api,
    atom,
    Ecosystem,
    ExportsOf,
    inject,
    StateOf,
} from "@zedux/react";
import { Context } from "react";
import { Override } from "../lib/type-utils";
import { TAppRouter } from "~/router";

export const ROUTER_HELPERS_ATOM_KEY = "router-helpers-atom";

export const routerAtom = atom(
    ROUTER_HELPERS_ATOM_KEY,
    () => {
        const router = inject(getRouterContext() as Context<TAppRouter>);
        // const router = inject(getRouterContext() as Context<TAppRouter>)
        return api(router);
    },
    {
        tags: ["router", "unserializable"],
    },
);

export const ecosystemFindRouterAtom = (ecosystem: Ecosystem) => {
    const routerAtomInstance = ecosystem.find(
        ROUTER_HELPERS_ATOM_KEY,
    ) as AnyAtomInstance<
        Override<
            AnyAtomGenerics,
            {
                Exports: ExportsOf<typeof routerAtom>;
                State: StateOf<typeof routerAtom>;
            }
        >
    >;
    if (!routerAtomInstance) {
        throw new Error(`${ROUTER_HELPERS_ATOM_KEY} not found`);
    }
    return routerAtomInstance;
};

export const ecosystemInvalidateRouter = (ecosystem: Ecosystem) => {
    const routerAtomInstance = ecosystemFindRouterAtom(ecosystem);
    routerAtomInstance.getOnce().invalidate();
};
