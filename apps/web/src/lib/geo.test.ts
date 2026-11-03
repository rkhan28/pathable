import { describe, expect, it } from "vitest";
import { inNorthYorkBbox, parseCoordinates } from "./geo";

describe("parseCoordinates", () => {
  it.each([
    ["43.7741, -79.4996", [-79.4996, 43.7741]],
    ["43.7741,-79.4996", [-79.4996, 43.7741]],
    ["-79.4996 43.7741", [-79.4996, 43.7741]],
    ["geo:43.7741,-79.4996", [-79.4996, 43.7741]],
  ])("%s", (input, expected) => expect(parseCoordinates(input)).toEqual(expected));

  it.each(["Finch West", "43.77", "200, 300", ""])("rejects %s", (input) => expect(parseCoordinates(input)).toBeNull());

  it("knows the pilot area", () => {
    expect(inNorthYorkBbox([-79.4996, 43.7741])).toBe(true);
    expect(inNorthYorkBbox([-79.3832, 43.6532])).toBe(false); // Toronto City Hall
  });
});
