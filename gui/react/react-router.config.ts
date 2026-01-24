import type { Config } from "@react-router/dev/config"
import $ from "@core/constants"

export default {
  ssr: true,
  prerender: false,
  basename: $.artifacts.lambda.gui.basepath,
  serverModuleFormat: "esm",
  serverBuildFile: "index.js",
  future: {
    v8_splitRouteModules: "enforce"
  }
} satisfies Config
