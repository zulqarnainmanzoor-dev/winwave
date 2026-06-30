/// <reference types="vite/client" />

// Allow TypeScript to import CSS for side effects.
// (Some TS setups treat plain CSS as needing a module declaration.)

declare module "*.css" {
  const css: string;
  export default css;
}

