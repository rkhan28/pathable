import { describe, expect, it } from "vitest";
import { parseCoordinates } from "@/api/geocoding";
import { formatDistance, formatDuration, formatPercent, formatRelativeTime } from "./format";
import { boundsOf, haversineMeters, pointAlong } from "./geo";

describe("format", () => {
  it("formats distances for Canadian English and French", () => {
    expect(formatDistance(960, "en-CA")).toBe("960 m");
    expect(formatDistance(1234, "en-CA")).toBe("1.2 km");
    expect(formatDistance(1234, "fr-CA")).toMatch(/1,2\s?km/);
  });

  it("rounds short distances sensibly", () => {
    expect(formatDistance(37, "en-CA")).toBe("35 m");
    expect(formatDistance(2, "en-CA")).toBe("5 m");
  });

  it("formats durations with hours and minutes", () => {
    expect(formatDuration(16 * 60, "en-CA")).toMatch(/16\s?min/);
    expect(formatDuration(90 * 60, "en-CA", "long")).toMatch(/1 hour.*30 minutes/);
    expect(formatDuration(10, "en-CA")).toMatch(/1\s?min/);
  });

  it("formats percentages per locale", () => {
    expect(formatPercent(0.69, "en-CA")).toBe("69%");
    expect(formatPercent(0.69, "fr-CA")).toMatch(/69\s?%/);
  });

  it("formats relative times", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    expect(formatRelativeTime("2026-07-07T12:00:00Z", "en-CA", now)).toBe("3 days ago");
    expect(formatRelativeTime("2026-07-07T12:00:00Z", "fr-CA", now)).toBe("il y a 3 jours");
  });
});

describe("geo", () => {
  it("measures distance between Union Station and St. Lawrence Market (~830 m)", () => {
    const d = haversineMeters({ lat: 43.6453, lng: -79.3806 }, { lat: 43.6487, lng: -79.3715 });
    expect(d).toBeGreaterThan(780);
    expect(d).toBeLessThan(880);
  });

  it("computes bounds and interpolates along a line", () => {
    const coords: [number, number][] = [[-79.4, 43.6], [-79.3, 43.7]];
    expect(boundsOf(coords)).toEqual([[-79.4, 43.6], [-79.3, 43.7]]);
    const [lng, lat] = pointAlong(coords, 0.5);
    expect(lng).toBeCloseTo(-79.35, 2);
    expect(lat).toBeCloseTo(43.65, 2);
  });

  it("parses pasted coordinates", () => {
    expect(parseCoordinates("43.6453, -79.3806")).toEqual({ lat: 43.6453, lng: -79.3806 });
    expect(parseCoordinates("43.6453 -79.3806")).toEqual({ lat: 43.6453, lng: -79.3806 });
    expect(parseCoordinates("Union Station")).toBeNull();
    expect(parseCoordinates("123, 456")).toBeNull();
  });
});
