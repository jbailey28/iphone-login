import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The sign-in pages are tested in a pretend browser: React Native's web version
  // stands in for the phone, and the Google logo is a plain stand-in.
  resolve: {
    alias: {
      'react-native-svg': fileURLToPath(new URL('./tests/ui/svgStandIn.tsx', import.meta.url)),
      'react-native': 'react-native-web',
    },
  },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    // One local Supabase is shared; its rate limits count every test together.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
