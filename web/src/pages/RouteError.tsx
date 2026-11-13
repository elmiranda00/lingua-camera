// Shown when a route's loader or component throws
import { isRouteErrorResponse, useRouteError } from "react-router";

export function RouteError() {
  const error = useRouteError();
  console.error(error);
  const message = isRouteErrorResponse(error)
    ? `Something went wrong (${error.status}).`
    : "Something went wrong.";

  return (
    <main>
      <h1>{message}</h1>
      <button type="button" onClick={() => window.location.reload()}>
        Try again
      </button>
    </main>
  );
}
