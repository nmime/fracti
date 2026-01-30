import $ from '@libs/constants';
import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  prerender: false,
  basename: $.artifacts.lambda.gui.basepath,
  serverModuleFormat: 'esm',
  serverBuildFile: 'index.js',
  future: {
    v8_splitRouteModules: 'enforce',
  },
} satisfies Config;
