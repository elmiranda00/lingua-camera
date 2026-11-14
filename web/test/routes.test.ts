import { describe, expect, it } from "vitest";
import { matchRoutes } from "react-router";
import { routes } from "../src/routes.tsx";

describe("routes", () => {
  it("matches / to the camera route, which has no loader", () => {
    const route = matchRoutes(routes, "/")?.[0]?.route;
    expect(route?.path).toBe("/");
    expect(route?.loader).toBeUndefined();
  });

  it("matches /about to the route that loads the API version", () => {
    const route = matchRoutes(routes, "/about")?.[0]?.route;
    expect(route?.path).toBe("/about");
    expect(route?.loader).toBeDefined();
  });

  it("matches /join to the sign-in route, which has a loader", () => {
    const route = matchRoutes(routes, "/join")?.[0]?.route;
    expect(route?.path).toBe("/join");
    expect(route?.loader).toBeDefined();
  });

  it("sends unknown paths to the not-found route", () => {
    expect(matchRoutes(routes, "/nope/at/all")?.[0]?.route.path).toBe("*");
  });
});
