// Creates the browser router
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { routes } from "./routes.tsx";

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
