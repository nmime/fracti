import type { Config } from "@react-router/dev/config"
import $ from "@core/constants"

export default {
  ssr: true,
  prerender: ["/"],
  basename: $.artifacts.lambda.gui.basepath,
  future: {
    v8_splitRouteModules: "enforce"
  }
} satisfies Config
