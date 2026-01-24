import { Wallet, LogOut } from 'lucide-react'
import { useTonPayment, useFormattedAddress } from '@/lib/ton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ClientOnly } from '@/components/ClientOnly'

function WalletButtonInner() {
  const { isConnected, connect, disconnect } = useTonPayment()
  const formattedAddress = useFormattedAddress()

  if (!isConnected) {
    return (
      <Button onClick={connect} variant="ton" className="gap-2">
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="h-4 w-4 text-ton" />
          {formattedAddress?.short}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            if (formattedAddress?.full) {
              navigator.clipboard.writeText(formattedAddress.full)
            }
          }}
        >
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={disconnect} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Wrapped component that only renders on client to avoid SSR errors with TonConnect
export function WalletButton() {
  return (
    <ClientOnly
      fallback={
        <Button variant="outline" className="gap-2" disabled>
          <Wallet className="h-4 w-4" />
          Loading...
        </Button>
      }
    >
      <WalletButtonInner />
    </ClientOnly>
  )
}
