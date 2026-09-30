import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    // Framework-free helpers (FEN, motion model, SVG renderer) for Node,
    // workers and React Native. Shares chunks with the main entry.
    core: 'src/core/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  treeshake: true,
  splitting: true,
  // Ship minified: consumers get the small bundle even without their own
  // minifier (CDNs, bundlephobia, Node SSR); sourcemaps keep it debuggable.
  minify: true,
});
