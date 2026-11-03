import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

// jsx-a11y: every rule in the strict preset is an error, not a warning.
const a11yStrict = Object.fromEntries(
  Object.keys(jsxA11y.configs.strict.rules).map((rule) => [rule, "error"]),
);

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      ...a11yStrict,
      // Deprecated rule that demands both nesting and id; label-has-associated-control replaces it.
      "jsx-a11y/label-has-for": "off",
      "jsx-a11y/label-has-associated-control": ["error", { assert: "either" }],
      // Inputs are labelled by <label> elements, which this rule cannot see; axe checks them in e2e.
      "jsx-a11y/control-has-associated-label": ["error", { ignoreElements: ["input", "textarea", "select"] }],
      "@next/next/no-img-element": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", "public/vendor/**", "playwright-report/**", "test-results/**"]),
]);
