import type { RouteConfig } from "@react-router/dev/routes"
import { index, route } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("expenses", "routes/expenses.tsx"),
  route("settle", "routes/settle.tsx"),
  route("analytics", "routes/analytics.tsx"),
  route("scan", "routes/scan.tsx"),
  route("recurring", "routes/recurring.tsx"),
  route("ok", "routes/healthcheck.tsx"),
] satisfies RouteConfig
