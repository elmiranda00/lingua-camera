import { describe, expect, it } from "vitest";
import { matchRoutes } from "react-router";
import { routes } from "../src/routes.tsx";

describe("routes", () => {
  it("matches / to the home route", () => {
    expect(matchRoutes(routes, "/")?.[0]?.route.path).toBe("/");
  });

  it("sends unknown paths to the not-found route", () => {
    expect(matchRoutes(routes, "/nope/at/all")?.[0]?.route.path).toBe("*");
  });
});
