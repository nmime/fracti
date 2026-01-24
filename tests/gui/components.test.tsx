import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}))

// Mock lucide-react
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="alert-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  Users: () => <div data-testid="users-icon" />,
}))

// Mock the logger
vi.mock('../../gui/react/app/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('React Components', () => {
  describe('ExpenseCard', () => {
    const mockExpense = {
      id: 'exp-1',
      groupId: 'group-1',
      payerId: 'user-1',
      payerName: 'Alice',
      amount: 100,
      description: 'Lunch at restaurant',
      splitType: 'equal' as const,
      splits: [
        { userId: 'user-1', userName: 'Alice', amount: 50 },
        { userId: 'user-2', userName: 'Bob', amount: 50 },
      ],
      createdAt: '2024-01-15T10:00:00Z',
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should render expense description', async () => {
      const { ExpenseCard } = await import('../../gui/react/app/components/ExpenseCard')
      render(<ExpenseCard expense={mockExpense} />)

      expect(screen.getByText('Lunch at restaurant')).toBeInTheDocument()
    })

    it('should render payer name', async () => {
      const { ExpenseCard } = await import('../../gui/react/app/components/ExpenseCard')
      render(<ExpenseCard expense={mockExpense} />)

      expect(screen.getByText(/Paid by/)).toBeInTheDocument()
    })

    it('should show "You paid" when current user is payer', async () => {
      const { ExpenseCard } = await import('../../gui/react/app/components/ExpenseCard')
      render(<ExpenseCard expense={mockExpense} currentUserId="user-1" />)

      expect(screen.getByText('Paid by you')).toBeInTheDocument()
      expect(screen.getByText('You paid')).toBeInTheDocument()
    })

    it('should show "You owe" amount when current user owes', async () => {
      const { ExpenseCard } = await import('../../gui/react/app/components/ExpenseCard')
      render(<ExpenseCard expense={mockExpense} currentUserId="user-2" />)

      expect(screen.getByText(/You owe/)).toBeInTheDocument()
    })

    it('should render number of people in split', async () => {
      const { ExpenseCard } = await import('../../gui/react/app/components/ExpenseCard')
      render(<ExpenseCard expense={mockExpense} />)

      expect(screen.getByText('2 people')).toBeInTheDocument()
    })

    it('should render delete button when onDelete provided', async () => {
      const onDelete = vi.fn()
      const { ExpenseCard } = await import('../../gui/react/app/components/ExpenseCard')
      render(<ExpenseCard expense={mockExpense} onDelete={onDelete} />)

      const deleteButton = screen.getByRole('button', { name: /delete expense/i })
      expect(deleteButton).toBeInTheDocument()
    })

    it('should call onDelete when delete button clicked', async () => {
      const onDelete = vi.fn()
      const { ExpenseCard } = await import('../../gui/react/app/components/ExpenseCard')
      render(<ExpenseCard expense={mockExpense} onDelete={onDelete} />)

      const deleteButton = screen.getByRole('button', { name: /delete expense/i })
      fireEvent.click(deleteButton)

      expect(onDelete).toHaveBeenCalledWith('exp-1')
    })

    it('should not render delete button when onDelete not provided', async () => {
      const { ExpenseCard } = await import('../../gui/react/app/components/ExpenseCard')
      render(<ExpenseCard expense={mockExpense} />)

      const deleteButton = screen.queryByRole('button', { name: /delete expense/i })
      expect(deleteButton).not.toBeInTheDocument()
    })

    it('should render payer avatar initial', async () => {
      const { ExpenseCard } = await import('../../gui/react/app/components/ExpenseCard')
      render(<ExpenseCard expense={mockExpense} />)

      expect(screen.getByText('A')).toBeInTheDocument()
    })
  })

  describe('ErrorBoundary', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error')
    }

    const SafeComponent = () => <div>Safe content</div>

    beforeEach(() => {
      vi.clearAllMocks()
      // Suppress error boundary console errors in tests
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('should render children when no error', async () => {
      const { ErrorBoundary } = await import('../../gui/react/app/components/ErrorBoundary')
      render(
        <ErrorBoundary>
          <SafeComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Safe content')).toBeInTheDocument()
    })

    it('should render error UI when child throws', async () => {
      const { ErrorBoundary } = await import('../../gui/react/app/components/ErrorBoundary')
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('common.error')).toBeInTheDocument()
    })

    it('should render custom fallback when provided', async () => {
      const { ErrorBoundary } = await import('../../gui/react/app/components/ErrorBoundary')
      render(
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    })

    it('should render retry button', async () => {
      const { ErrorBoundary } = await import('../../gui/react/app/components/ErrorBoundary')
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /common.retry/i })).toBeInTheDocument()
    })

    it('should display error message', async () => {
      const { ErrorBoundary } = await import('../../gui/react/app/components/ErrorBoundary')
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Test error')).toBeInTheDocument()
    })
  })

  describe('UI Components', () => {
    describe('Button', () => {
      it('should render button with text', async () => {
        const { Button } = await import('../../gui/react/app/components/ui/button')
        render(<Button>Click me</Button>)

        expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
      })

      it('should handle click events', async () => {
        const onClick = vi.fn()
        const { Button } = await import('../../gui/react/app/components/ui/button')
        render(<Button onClick={onClick}>Click me</Button>)

        fireEvent.click(screen.getByRole('button'))
        expect(onClick).toHaveBeenCalledTimes(1)
      })

      it('should be disabled when disabled prop is true', async () => {
        const { Button } = await import('../../gui/react/app/components/ui/button')
        render(<Button disabled>Click me</Button>)

        expect(screen.getByRole('button')).toBeDisabled()
      })

      it('should apply variant classes', async () => {
        const { Button } = await import('../../gui/react/app/components/ui/button')
        render(<Button variant="destructive">Delete</Button>)

        const button = screen.getByRole('button')
        expect(button).toHaveClass('bg-destructive')
      })

      it('should apply size classes', async () => {
        const { Button } = await import('../../gui/react/app/components/ui/button')
        render(<Button size="sm">Small</Button>)

        const button = screen.getByRole('button')
        expect(button).toHaveClass('h-9')
      })
    })

    describe('Card', () => {
      it('should render card with children', async () => {
        const { Card, CardContent } = await import('../../gui/react/app/components/ui/card')
        render(
          <Card>
            <CardContent>Card content</CardContent>
          </Card>
        )

        expect(screen.getByText('Card content')).toBeInTheDocument()
      })

      it('should render card with header', async () => {
        const { Card, CardHeader, CardTitle } = await import('../../gui/react/app/components/ui/card')
        render(
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
            </CardHeader>
          </Card>
        )

        expect(screen.getByText('Card Title')).toBeInTheDocument()
      })
    })

    describe('Input', () => {
      it('should render input', async () => {
        const { Input } = await import('../../gui/react/app/components/ui/input')
        render(<Input placeholder="Enter text" />)

        expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
      })

      it('should handle value changes', async () => {
        const onChange = vi.fn()
        const { Input } = await import('../../gui/react/app/components/ui/input')
        render(<Input onChange={onChange} />)

        const input = screen.getByRole('textbox')
        fireEvent.change(input, { target: { value: 'test' } })

        expect(onChange).toHaveBeenCalled()
      })

      it('should be disabled when disabled prop is true', async () => {
        const { Input } = await import('../../gui/react/app/components/ui/input')
        render(<Input disabled />)

        expect(screen.getByRole('textbox')).toBeDisabled()
      })
    })

    describe('Avatar', () => {
      it('should render avatar fallback', async () => {
        const { Avatar, AvatarFallback } = await import('../../gui/react/app/components/ui/avatar')
        render(
          <Avatar>
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
        )

        expect(screen.getByText('AB')).toBeInTheDocument()
      })
    })

    describe('Label', () => {
      it('should render label with text', async () => {
        const { Label } = await import('../../gui/react/app/components/ui/label')
        render(<Label>Username</Label>)

        expect(screen.getByText('Username')).toBeInTheDocument()
      })

      it('should associate with input via htmlFor', async () => {
        const { Label } = await import('../../gui/react/app/components/ui/label')
        const { Input } = await import('../../gui/react/app/components/ui/input')
        render(
          <>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" />
          </>
        )

        const label = screen.getByText('Email')
        expect(label).toHaveAttribute('for', 'email')
      })
    })
  })
})
