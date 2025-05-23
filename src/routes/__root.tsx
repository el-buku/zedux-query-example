import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { EcosystemProvider } from "@zedux/react";
import * as React from "react";
import { useMemo } from "react";
import { createRootEcosystem } from "~/atoms/ecosystem";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";

export type TRootRouteContext = {
  rootEcosystem: ReturnType<typeof createRootEcosystem>;
};
export const Route = createRootRouteWithContext<TRootRouteContext>()({
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
  loader: (ctx) => {
    const snapshot = ctx.context.rootEcosystem.dehydrate({
      exclude: ["unserializable"],
      excludeTags: ["unserializable"],
    });
    ctx.context.rootEcosystem.reset();
    return {
      snapshot,
    };
  },
});

function RootComponent() {
  const loaded = Route.useLoaderData();
  const ecosystem = useMemo(() => {
    const newEcosystem = createRootEcosystem();
    newEcosystem.hydrate(loaded.snapshot);
    // NOTE: atoms can be preloaded here via `newEcosystem.getNode(myAtom)`

    return newEcosystem;
  }, []);
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

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
