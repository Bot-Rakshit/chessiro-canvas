import { writeFileSync } from 'node:fs';
import { defineConfig } from 'tsup';
import type { Options } from 'tsup';

const shared: Options = {
  entry: { index: 'src/index.ts' },
  sourcemap: true,
  target: 'es2020',
  treeshake: true,
  // Only the peers stay external: the shared core (../src/core) is bundled
  // in, so this package never pulls in the web package or react-dom.
  external: [
    'react',
    'react/jsx-runtime',
    'react-native',
    'react-native-reanimated',
    'react-native-gesture-handler',
    'react-native-svg',
  ],
  // Not minified: the app's Reanimated Babel plugin must find the 'worklet'
  // directives, and Metro minifies release builds anyway.
  minify: false,
  // `npm run build` wipes dist first; per-config cleaning would race.
  clean: false,
};

export default defineConfig([
  // CommonJS for Node/Jest (`main`).
  { ...shared, format: ['cjs'], outDir: 'dist', dts: true },
  // ESM for Metro (`react-native`) and bundlers (`module`). Metro should get
  // ESM: the Reanimated plugin then sees `withTiming` & co. as plain imported
  // bindings inside worklets, rather than members of a required module object.
  {
    ...shared,
    format: ['esm'],
    outDir: 'dist/esm',
    dts: false,
    outExtension: () => ({ js: '.js' }),
    async onSuccess() {
      writeFileSync('dist/esm/package.json', '{ "type": "module" }\n');
    },
  },
]);
