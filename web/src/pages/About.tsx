// About page: shows which API version the app is talking to
import { useLoaderData } from "react-router";
import type { aboutLoader } from "./aboutLoader.ts";

export function About() {
  const { version } = useLoaderData<typeof aboutLoader>();

  return (
    <main>
      <h1>Lingua Camera</h1>
      <p>{version ? `API ${version}` : "API unreachable"}</p>
    </main>
  );
}
