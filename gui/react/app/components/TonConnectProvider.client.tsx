// This file is only loaded on the client (due to .client.tsx suffix)
import { TonConnectUIProvider } from "@tonconnect/ui-react"
import type { ReactNode } from "react"

const manifestUrl = "https://raw.githubusercontent.com/example/fracti/main/tonconnect-manifest.json"

export function TonConnectProvider({ children }: { children: ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  )
}
