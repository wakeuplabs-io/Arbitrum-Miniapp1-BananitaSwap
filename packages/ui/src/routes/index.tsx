import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/swap",
      search: {
        token: undefined,
        mode: "buy",
      },
    });
  },
});
