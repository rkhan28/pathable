// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { ENABLED_LOCALES, LOCALES } from "./locales";
import { routing } from "./routing";

const dir = fileURLToPath(new URL("../messages/", import.meta.url));
const load = (code: string) => JSON.parse(readFileSync(`${dir}${code}.json`, "utf8"));

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") acc[key] = v;
    else Object.assign(acc, flatten(v as Record<string, unknown>, key));
    return acc;
  }, {});
}

/** Top-level ICU argument names, e.g. {count, plural, ...} -> count. */
function args(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    if (message[i] === "{") {
      if (depth === 0) {
        const m = /^\{\s*([\w]+)/.exec(message.slice(i));
        if (m) names.add(m[1]);
      }
      depth++;
    } else if (message[i] === "}") depth--;
  }
  return [...names].sort();
}

const english = flatten(load("en-CA"));

/** Words that are spelled the same in both languages, reviewed by hand. */
const IDENTICAL_ALLOWED: Record<string, string[]> = {
  "fr-CA": [
    "common.source", "common.minutes", "nav.menu", "nav.footer", "search.label", "route.distance",
    "hazards.kinds.obstacle", "settings.contrastNormal", "palette.groupActions", "meta.title",
    "meta.titleTemplate", "sources.osm",
  ],
};

describe("message catalogues", () => {
  it("only enabled languages have files, and every enabled language has one", () => {
    const files = readdirSync(dir).map((f) => f.replace(/\.json$/, "")).sort();
    expect(files).toEqual([...ENABLED_LOCALES].sort());
  });

  it("the enabled list matches the registry and the router", () => {
    expect(ENABLED_LOCALES).toEqual(LOCALES.filter((l) => l.enabled).map((l) => l.code));
    expect([...routing.locales]).toEqual(ENABLED_LOCALES);
    expect(LOCALES).toHaveLength(12);
    expect(LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code).sort()).toEqual(["ar", "ur"]);
  });

  describe.each(ENABLED_LOCALES.filter((c) => c !== "en-CA"))("%s", (code) => {
    const other = flatten(load(code));

    it("has exactly the English keys", () => {
      expect(Object.keys(other).sort()).toEqual(Object.keys(english).sort());
    });

    it("uses the same placeholders as English", () => {
      for (const key of Object.keys(english)) expect([key, args(other[key] ?? "")]).toEqual([key, args(english[key])]);
    });

    it("is not a copy of English", () => {
      const allowed = new Set(IDENTICAL_ALLOWED[code] ?? []);
      const same = Object.keys(english).filter(
        (k) => other[k] === english[k] && !allowed.has(k) && !/^\{value, number, [^}]*\}( [a-z%]+)?$/.test(english[k]),
      );
      expect(same).toEqual([]);
    });
  });

  it.each(ENABLED_LOCALES)("%s messages are valid ICU", (code) => {
    for (const [key, message] of Object.entries(flatten(load(code)))) {
      expect(() => new IntlMessageFormat(message, code), key).not.toThrow();
    }
  });
});
