import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, TrendingUp, TrendingDown, Users, Receipt } from 'lucide-react'
import { useTelegram } from '@/lib/telegram'
import { api, type DebtGraph as DebtGraphType, type Group } from '@/lib/api'
import { formatTON } from '@/lib/utils'
import { DebtGraph } from '@/components/DebtGraph'
import { WalletButton } from '@/components/WalletButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

// Demo data for visualization
const demoDebtGraph: DebtGraphType = {
  nodes: [
    { id: '1', name: 'You', balance: 45.5, wallet: 'EQA...' },
    { id: '2', name: 'Alice', balance: -22.0 },
    { id: '3', name: 'Bob', balance: -15.5 },
    { id: '4', name: 'Charlie', balance: -8.0 },
  ],
  edges: [
    { from: '2', to: '1', amount: 22.0 },
    { from: '3', to: '1', amount: 15.5 },
    { from: '4', to: '1', amount: 8.0 },
  ],
}

const demoGroup: Group = {
  id: 'demo',
  chatId: '123456',
  title: 'Vegas Trip',
  createdAt: new Date().toISOString(),
  memberCount: 4,
}

export default function HomePage() {
  const { user } = useTelegram()
  const navigate = useNavigate()
  const [debtGraph, setDebtGraph] = useState<DebtGraphType>(demoDebtGraph)
  const [group] = useState<Group>(demoGroup)
  const [isLoading, setIsLoading] = useState(false)

  const userNode = debtGraph.nodes.find((n) => n.name === 'You')
  const userBalance = userNode?.balance ?? 0
  const isOwed = userBalance > 0

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // In production, fetch from API
        // const data = await api.getDebts(group.id)
        // setDebtGraph(data)
      } catch (error) {
        console.error('Failed to load debt graph:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  return (
    <div className="space-y-6 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Hey, {user?.first_name ?? 'there'}
          </h1>
          <p className="text-sm text-muted-foreground">{group.title}</p>
        </div>
        <WalletButton />
      </div>

      {/* Balance Card */}
      <Card className={isOwed ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isOwed ? 'You are owed' : 'You owe'}
              </p>
              <p className={`text-3xl font-bold ${isOwed ? 'text-green-600' : 'text-red-600'}`}>
                {formatTON(Math.abs(userBalance))} TON
              </p>
            </div>
            <div className={`rounded-full p-3 ${isOwed ? 'bg-green-100' : 'bg-red-100'}`}>
              {isOwed ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
          {!isOwed && userBalance !== 0 && (
            <Button
              variant="ton"
              className="mt-4 w-full"
              onClick={() => navigate('/settle')}
            >
              Settle Up
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Debt Graph */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Debt Web</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <DebtGraph
              data={debtGraph}
              onNodeClick={(node) => console.log('Clicked:', node)}
            />
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => navigate('/expenses')}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">12</p>
              <p className="text-xs text-muted-foreground">Expenses</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{group.memberCount}</p>
              <p className="text-xs text-muted-foreground">Members</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/expenses')}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: 'Alice', action: 'paid', item: 'Dinner', amount: 120 },
            { name: 'Bob', action: 'paid', item: 'Uber', amount: 35 },
            { name: 'You', action: 'paid', item: 'Groceries', amount: 85 },
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {activity.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {activity.name} {activity.action} for {activity.item}
                  </p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
              <span className="font-medium text-primary">
                {formatTON(activity.amount)} TON
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
