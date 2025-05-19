import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'
import { createRootEcosystem } from './atoms/ecosystem'
import { EMPTY_AUTH_STATE } from './atoms/auth/auth-atom'

export function createRouter() {

  return createTanStackRouter({
    routeTree,
    context: { rootEcosystem: createRootEcosystem(), authState: EMPTY_AUTH_STATE },
    defaultPreload: "intent",
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    defaultPendingMinMs: 0,
    defaultPendingMs: 0,
  })
}

export type TAppRouter = ReturnType<typeof createRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: TAppRouter;
  }
}
