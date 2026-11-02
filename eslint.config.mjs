import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "client/src/platform.d.ts",
      "client/src/vite-env.d.ts",
      "server/http/types.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        Headers: "readonly",
        Response: "readonly",
        Request: "readonly",
        FormData: "readonly",
        File: "readonly",
        DOMException: "readonly",
        Uint8Array: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
        localStorage: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^React$",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        atob: "readonly",
      },
    },
  },
  {
    files: ["client/src/**/*.{ts,tsx}", "server/http/**/*.ts"],
    rules: { "no-console": "error" },
  }
);
