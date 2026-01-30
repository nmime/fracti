import { DefaultCurrency } from '@libs/types';
import { currencyService, SUPPORTED_CURRENCIES, type Currency } from '../services';
import type { Context } from 'hono';

export class CurrencyController {
  async getRates(c: Context, base: string = DefaultCurrency) {
    const baseCurrency = base.toUpperCase() as Currency;

    if (!SUPPORTED_CURRENCIES.includes(baseCurrency)) {
      return c.json(
        {
          success: false,
          error: `Unsupported currency: ${base}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`,
        },
        400,
      );
    }

    const rates = await currencyService.getAllRates(baseCurrency);

    return c.json({
      success: true,
      data: {
        base: baseCurrency,
        rates,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async convert(c: Context, from: string, to: string, amount: number) {
    const fromCurrency = from.toUpperCase() as Currency;
    const toCurrency = to.toUpperCase() as Currency;

    if (!SUPPORTED_CURRENCIES.includes(fromCurrency)) {
      return c.json(
        {
          success: false,
          error: `Unsupported currency: ${from}`,
        },
        400,
      );
    }

    if (!SUPPORTED_CURRENCIES.includes(toCurrency)) {
      return c.json(
        {
          success: false,
          error: `Unsupported currency: ${to}`,
        },
        400,
      );
    }

    const converted = await currencyService.convertCurrency(amount, fromCurrency, toCurrency);

    return c.json({
      success: true,
      data: {
        from: fromCurrency,
        to: toCurrency,
        amount,
        converted,
        formatted: currencyService.formatCurrency(converted, toCurrency),
      },
    });
  }
}

export const currencyController = new CurrencyController();
