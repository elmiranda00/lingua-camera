// Invite-link landing page: tells the user whether sign-in worked
import { useEffect } from "react";
import { Link, useLoaderData } from "react-router";
import type { joinLoader } from "./joinLoader.ts";

export function Join() {
  const result = useLoaderData<Awaited<ReturnType<typeof joinLoader>>>();

  // A link pasted into a tab already on /join only changes the fragment, which doesn't re-run the loader
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("hashchange", reload);
    return () => window.removeEventListener("hashchange", reload);
  }, []);

  switch (result.status) {
    case "signed-in":
      return (
        <main>
          <h1>You're signed in</h1>
          <p role="status">Welcome, {result.name}.</p>
          <Link to="/">Open the camera</Link>
        </main>
      );
    case "not-saved":
      return (
        <main>
          <h1>Couldn't stay signed in</h1>
          <p role="alert">
            The link works, but this browser won't save your sign-in (private browsing?). Open the link in a normal tab.
          </p>
        </main>
      );
    case "rejected":
      return (
        <main>
          <h1>Sign-in needed</h1>
          <p role="alert">This invite link isn't valid any more. Ask for a new one.</p>
        </main>
      );
    case "bad-link":
      return (
        <main>
          <h1>Sign-in needed</h1>
          <p role="alert">This link looks incomplete. Copy the whole link and open it again.</p>
        </main>
      );
    case "unreachable":
      return (
        <main>
          <h1>Couldn't reach the server</h1>
          <p role="alert">Check your connection, then reload this page.</p>
        </main>
      );
    case "no-link":
      return (
        <main>
          <h1>Sign-in needed</h1>
          <p role="status">Open the invite link you were sent.</p>
        </main>
      );
  }
}
