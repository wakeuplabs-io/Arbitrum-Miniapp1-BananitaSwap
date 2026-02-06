import { routeTree } from "@/routeTree.gen";
import { createRouter, RouterProvider as TanstackRouterProvider } from "@tanstack/react-router";

export const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function RouterProvider() {
  return <TanstackRouterProvider router={router} />;
}
