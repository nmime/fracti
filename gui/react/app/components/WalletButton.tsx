import { Wallet, LogOut } from 'lucide-react'
import { useTonPayment, useFormattedAddress } from '@/lib/ton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function WalletButton() {
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
