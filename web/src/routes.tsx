// Route table (data router: each route can have a loader and an error page)
// The camera route has no loader: it must show at once and never wait on the API
import type { RouteObject } from "react-router";
import { About } from "./pages/About.tsx";
import { aboutLoader } from "./pages/aboutLoader.ts";
import { Camera } from "./pages/Camera.tsx";
import { Loading } from "./pages/Loading.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { RouteError } from "./pages/RouteError.tsx";

export const routes: RouteObject[] = [
  { path: "/", Component: Camera, ErrorBoundary: RouteError },
  {
    path: "/about",
    Component: About,
    loader: aboutLoader,
    HydrateFallback: Loading,
    ErrorBoundary: RouteError,
  },
  { path: "*", Component: NotFound },
];
