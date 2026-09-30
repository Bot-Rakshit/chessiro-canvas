// Browser harness: runs the native board through react-native-web so it can
// be screenshotted and driven by Playwright. Not part of the package.
import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// CC_SRC=1 serves the TypeScript sources; default is the built ESM bundle.
const entry = process.env.CC_SRC === '1' ? '../src/index.ts' : '../dist/esm/index.js';
// Reanimated 4 moved its Babel plugin to react-native-worklets.
const require = createRequire(import.meta.url);
const workletsPlugin = (() => {
  try {
    require.resolve('react-native-worklets/plugin');
    return 'react-native-worklets/plugin';
  } catch {
    return 'react-native-reanimated/plugin';
  }
})();
const webExtensions = ['.web.tsx', '.web.ts', '.web.mjs', '.web.js', '.tsx', '.ts', '.mjs', '.js', '.jsx', '.json'];

export default defineConfig({
  root: __dirname,
  // The Reanimated Babel plugin workletizes the board's 'worklet' functions
  // exactly as Metro would in an app (CC_NO_WORKLETS=1 skips it).
  plugins: [
    react({
      babel: { plugins: process.env.CC_NO_WORKLETS === '1' ? [] : [workletsPlugin] },
    }),
  ],
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: /^chessiro-canvas-native$/, replacement: path.resolve(__dirname, entry) },
    ],
    extensions: webExtensions,
  },
  define: {
    __DEV__: 'true',
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: webExtensions,
      loader: { '.js': 'jsx' },
      define: { global: 'globalThis', __DEV__: 'true' },
    },
  },
  server: { port: 5199, strictPort: true },
});
