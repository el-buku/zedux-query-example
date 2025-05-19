import { api, atom, injectSignal } from "@zedux/react";
import { invalidateTag } from "./query-atom/invalidate-tag";
import { AUTHENTICATED_QUERY_TAG } from "./query-atom/_utils";

export const authAtom = atom("auth", () => {
    const tokenSignal = injectSignal<string | null>("SOME_TOKEN");
    return api(tokenSignal).setExports({
        setToken: (token: string | null) => {
            tokenSignal.set(token);
            invalidateTag(AUTHENTICATED_QUERY_TAG);
        },
    });
});
