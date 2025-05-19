import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  createRootRouteWithContext,
  stripSearchParams,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AtomProvider, EcosystemProvider, getDefaultEcosystem, setDefaultEcosystem, useAtomInstance } from "@zedux/react";
import * as React from "react";
import { ReactNode, useMemo } from "react";
import { createRootEcosystem } from "~/atoms/ecosystem";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { authAtom, AuthState, EMPTY_AUTH_STATE } from "~/atoms/auth/auth-atom";
import { getSessionAuth, setSessionAuth } from "~/atoms/auth/auth-fns";
import { zodValidator } from "@tanstack/zod-adapter";
import * as z from "zod";
import { routerAtom } from "~/atoms/router-atom";

export type TRootRouteContext = {
  rootEcosystem: ReturnType<typeof createRootEcosystem>;
  authState: AuthState;
};
export const Route = createRootRouteWithContext<TRootRouteContext>()({
  validateSearch:zodValidator(
    z.object({
      token: z.string().optional(),
    })
  ),
  search: {
    middlewares: [
      stripSearchParams(["token"]), // when redirected with a token query string param, we want the loader to get the token and then strip the param
    ],
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Zedux query atoms playground" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
  beforeLoad: async (ctx) => {
    if (ctx.search.token) { // token set via redirect, such as Google SSO
      const newAuthState = {
        token: ctx.search.token,
      } as AuthState;
      await setSessionAuth({ data: newAuthState });
      ctx.context.rootEcosystem
        .getNodeOnce(authAtom)
        .exports.setToken(newAuthState);
      return {
        authState: newAuthState,
      };
    }
    if (ctx.context.authState.token === EMPTY_AUTH_STATE.token) {
      const authState = await getSessionAuth();
      ctx.context.rootEcosystem
        .getNodeOnce(authAtom)
        .exports.setToken(authState ?? EMPTY_AUTH_STATE);
      return {
        authState: authState ?? EMPTY_AUTH_STATE,
      };
    }
  },
  loader: (ctx) => {
    const snapshot = ctx.context.rootEcosystem.dehydrate({
      exclude: ["unserializable"],
      excludeTags: ["unserializable"],
    });
    if (typeof window === "undefined") {
      ctx.context.rootEcosystem.reset();
    }
        return {
      snapshot,
      authState: ctx.context.authState,
    };
  },
});

function RootComponent() {
  const loaded = Route.useLoaderData();
  console.log("session authstate", loaded.authState);
  // This stuff needs to run synchronously before the component is mounted, so no useMemo
  const defaultEcosystem = getDefaultEcosystem();
  const wasAlreadyInitialized = defaultEcosystem.id === "root";
  const ecosystem = wasAlreadyInitialized
    ? defaultEcosystem
    : createRootEcosystem();
  const hasInited = React.useRef(false);
  if (!hasInited.current) {
    ecosystem.hydrate(loaded.snapshot, {
      retroactive: true,
    });
    hasInited.current = true;
  }
  if (!wasAlreadyInitialized) {
    setDefaultEcosystem(ecosystem);
  }
  if (!loaded) {
    return <div>Loading...</div>;
  }
  return (
    <EcosystemProvider ecosystem={ecosystem}>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </EcosystemProvider>
  );
}

function RouterAtomContextProvider({ children }: { children: ReactNode }) {
  // const router = useRouter();
  const routerAtomInstance = useAtomInstance(routerAtom);

  return <AtomProvider instance={routerAtomInstance}>{children}</AtomProvider>;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
   <RouterAtomContextProvider>
     <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
   </RouterAtomContextProvider>
  );
}
