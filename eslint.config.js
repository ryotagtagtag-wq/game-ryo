// eslint.config.js — ESLint v9 flat config (CommonJS)
const config = [
  {
    ignores: [
      "node_modules/",
      "_site/",
      "design/",
      ".11ty-cache/",
      "*.lock",
      "package-lock.json",
    ],
  },
  {
    files: ["*.js", "*.mjs", "*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        fetch: "readonly",
        URL: "readonly",
        atob: "readonly",
        btoa: "readonly",
        localStorage: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        addEventListener: "readonly",
        Crypto: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
  {
    files: ["eleventy.config.js"],
    languageOptions: {
      globals: {
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
      },
    },
  },
];

module.exports = config;
