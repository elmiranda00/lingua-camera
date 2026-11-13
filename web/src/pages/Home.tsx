// Placeholder home page (replaced by the camera in M1)
import { useLoaderData } from "react-router";
import type { homeLoader } from "./homeLoader.ts";

export function Home() {
  const { version } = useLoaderData<typeof homeLoader>();

  return (
    <main>
      <h1>Lingua Camera</h1>
      <p>{version ? `API ${version}` : "API unreachable"}</p>
    </main>
  );
}
