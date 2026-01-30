import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('Label Component', () => {
  it('should render label with text', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(<Label>Email Address</Label>);

    expect(screen.getByText('Email Address')).toBeInTheDocument();
  });

  it('should render required asterisk when required prop is true', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(<Label required>Username</Label>);

    const asterisk = screen.getByLabelText('required');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk).toHaveTextContent('*');
  });

  it('should not render asterisk when required prop is false', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(<Label required={false}>Optional Field</Label>);

    const asterisk = screen.queryByLabelText('required');
    expect(asterisk).not.toBeInTheDocument();
  });

  it('should not render asterisk when required prop is not provided', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(<Label>Normal Field</Label>);

    const asterisk = screen.queryByLabelText('required');
    expect(asterisk).not.toBeInTheDocument();
  });

  it('should set aria-required attribute when required is true', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(
      <Label required data-testid="label">
        Password
      </Label>,
    );

    const label = screen.getByTestId('label');
    expect(label).toHaveAttribute('aria-required', 'true');
  });

  it('should not set aria-required when required is false', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(
      <Label required={false} data-testid="label">
        Optional
      </Label>,
    );

    const label = screen.getByTestId('label');
    expect(label).not.toHaveAttribute('aria-required', 'true');
  });

  it('should apply custom className', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(
      <Label className="custom-class" data-testid="label">
        Custom Label
      </Label>,
    );

    const label = screen.getByTestId('label');
    expect(label).toHaveClass('custom-class');
  });

  it('should render required asterisk with correct styling class', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(<Label required>Required Field</Label>);

    const asterisk = screen.getByLabelText('required');
    expect(asterisk).toHaveClass('ml-1');
    expect(asterisk).toHaveClass('text-destructive');
  });

  it('should render children and asterisk together when required', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(<Label required>Full Name</Label>);

    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('required')).toBeInTheDocument();
  });

  it('should forward ref correctly', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    const ref = React.createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Ref Test</Label>);

    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });

  it('should pass through additional props', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(
      <Label htmlFor="test-input" data-testid="label">
        Test Label
      </Label>,
    );

    const label = screen.getByTestId('label');
    expect(label).toHaveAttribute('for', 'test-input');
  });

  it('should render with complex children', async () => {
    const { Label } = await import('../../apps/web/app/components/ui/label');
    render(
      <Label required>
        <span>Complex</span> Label
      </Label>,
    );

    expect(screen.getByText('Complex')).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByLabelText('required')).toBeInTheDocument();
  });
});
