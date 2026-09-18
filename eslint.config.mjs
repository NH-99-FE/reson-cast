import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort'

const eslintConfig = [
  { ignores: ['**/node_modules/**', '**/.next/**', 'dist/**'] },
  ...nextVitals,
  ...nextTypescript,
  {
    // Migration exception: these existing effects synchronize external widgets,
    // media/query state, or the generation lifecycle. Keep the remaining Hooks
    // checks enabled; remove entries when each synchronization flow is migrated.
    files: [
      'src/components/filter-carousel.tsx',
      'src/components/ui/carousel.tsx',
      'src/hooks/use-mobile.ts',
      'src/modules/studio/ui/hooks/use-generation-task.ts',
      'src/modules/videos/ui/components/video-player.tsx',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
  {
    plugins: { 'simple-import-sort': eslintPluginSimpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // "no-console": "error",
    },
  },
  eslintConfigPrettier,
]

export default eslintConfig
