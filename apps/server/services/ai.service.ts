import {
  parseExpenseWithFallback,
  parseReceiptWithFallback,
  type ParsedExpense,
  type ParsedReceipt,
  type AIResult,
} from '../integrations/bedrock';

class AIService {
  async parseExpenseText(text: string): Promise<AIResult<ParsedExpense>> {
    return parseExpenseWithFallback(text);
  }

  async parseReceiptImage(imageBase64: string, mimeType = 'image/jpeg'): Promise<AIResult<ParsedReceipt>> {
    return parseReceiptWithFallback(imageBase64, mimeType);
  }
}

export const aiService = new AIService();
