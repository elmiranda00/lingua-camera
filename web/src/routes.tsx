// Route table (data router: each route can have a loader and an error page)
import type { RouteObject } from "react-router";
import { Home } from "./pages/Home.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { RouteError } from "./pages/RouteError.tsx";

export const routes: RouteObject[] = [
  { path: "/", Component: Home, ErrorBoundary: RouteError },
  { path: "*", Component: NotFound },
];
