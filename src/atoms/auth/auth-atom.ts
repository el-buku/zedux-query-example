import {
    api,
    atom,
    Ecosystem,
    injectEcosystem,
    injectSignal,
} from "@zedux/react";
import { ecosystemInvalidateRouter } from "../router-atom";
import { resetSession, setSessionAuth } from "./auth-fns";
import { invalidateTag } from "../query-atom/invalidate-tag";
import { AUTHENTICATED_QUERY_TAG } from "../query-atom/_utils";

export const invalidateAuthedAtoms = () => {
    invalidateTag(AUTHENTICATED_QUERY_TAG);
};

export type AuthState = {
    token: string | null;
};

export const EMPTY_AUTH_STATE: AuthState = {
    token: null,
};

export const authAtom = atom("auth-atom", () => {
    const authStateSignal = injectSignal(() => EMPTY_AUTH_STATE);

    const authState = authStateSignal.get();
    const ecosystem = injectEcosystem();
    const state = {
        ...authState,
    };
    return api(state).setExports({
        setToken: async (
            newAuthState: AuthState | null,
            invalidateRouter = false,
        ) => {
            if (newAuthState) {
                authStateSignal.set(newAuthState);

                await setSessionAuth({ data: newAuthState });
                if (invalidateRouter) {
                    ecosystemInvalidateRouter(ecosystem);
                }
            } else {
                console.log("invalidation");
                authStateSignal.set(EMPTY_AUTH_STATE);
                console.log("invalidating atoms");
                invalidateAuthedAtoms();
                console.log("invalidating session");
                await resetSession();
                if (invalidateRouter) {
                    console.log("invalidating router");
                    ecosystemInvalidateRouter(ecosystem);
                }
            }
        },
    });
});

export const getAuthToken = (ecosystem: Ecosystem) => {
    const val = ecosystem.getNode(authAtom).getOnce().token;
    return val;
};
