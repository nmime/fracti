/**
 * Currency normalization utilities
 */

export function normalizeCurrency(input: string): string {
  const normalized = input.toLowerCase().trim();
  if (normalized === '$' || normalized.includes('dollar') || normalized.includes('buck') || normalized === 'usd') {
    return 'USD';
  }

  if (normalized === '€' || normalized === 'eur') {
    return 'EUR';
  }

  if (normalized === 'ton') {
    return 'TON';
  }

  return input.toUpperCase();
}
