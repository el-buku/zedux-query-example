import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { AuthState, EMPTY_AUTH_STATE } from "./auth-atom";

const SESSION_PASS =
    "securesecuresecuresecuresecuresecuresecuresecuresecuresecuresecuresecuresecuresecure32charpass";

export const getSessionAuth = createServerFn({ method: "GET" }).handler(
    async () => {
        const session = await useSession({ password: SESSION_PASS });
        return {
            ...EMPTY_AUTH_STATE,
            ...session.data,
        } as AuthState | undefined;
    },
);

export const setSessionAuth = createServerFn({ method: "POST" })
    .validator((d: AuthState) => d)
    .handler(async ({ data }: { data: AuthState }) => {
        console.log("called");
        // Create a session
        const session = await useSession({ password: SESSION_PASS });

        // Store the user's email in the session
        await session.update(data);
        console.log("updated");

        return {};
    });

export const resetSession = createServerFn({ method: "POST" }).handler(
    async () => {
        const session = await useSession({ password: SESSION_PASS });
        await session.clear();
        return {};
    },
);
