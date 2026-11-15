// Invite-link landing page: the welcome screen when sign-in worked, otherwise what went wrong
import { useEffect } from "react";
import { useLoaderData } from "react-router";
import { WelcomeMessage } from "../welcome/WelcomeMessage.tsx";
import { WelcomeScreen } from "../welcome/WelcomeScreen.tsx";
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
      return <WelcomeScreen name={result.name} />;
    case "not-saved":
      return (
        <WelcomeMessage title="Couldn't stay signed in" role="alert">
          The link works, but this browser won't save your sign-in (private browsing?). Open the link in a normal tab.
        </WelcomeMessage>
      );
    case "rejected":
      return (
        <WelcomeMessage title="Sign-in needed" role="alert">
          This invite link isn't valid any more. Ask for a new one.
        </WelcomeMessage>
      );
    case "bad-link":
      return (
        <WelcomeMessage title="Sign-in needed" role="alert">
          This link looks incomplete. Copy the whole link and open it again.
        </WelcomeMessage>
      );
    case "unreachable":
      return (
        <WelcomeMessage title="Couldn't reach the server" role="alert">
          Check your connection, then reload this page.
        </WelcomeMessage>
      );
    case "no-link":
      return (
        <WelcomeMessage title="Sign-in needed" role="status">
          Open the invite link you were sent.
        </WelcomeMessage>
      );
  }
}
