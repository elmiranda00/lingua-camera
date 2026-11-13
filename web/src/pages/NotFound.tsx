// Fallback for unknown paths
import { Link } from "react-router";

export function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link to="/">Back to the camera</Link>
    </main>
  );
}
