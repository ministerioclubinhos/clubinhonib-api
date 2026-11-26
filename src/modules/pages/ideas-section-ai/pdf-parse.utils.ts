import { IdeaPdfParser, ParsedIdeaPdfText } from './types';

/**
 * O `pdf.js` antigo embutido no `pdf-parse` falha de vez em quando ("bad XRef
 * entry") em PDFs válidos, e a leitura seguinte do mesmo arquivo funciona.
 * Sem repetir, um documento digitalizado ficava sem melhoria ao acaso e um PDF
 * de texto derrubava a tentativa. PDF realmente quebrado falha em todas.
 */
export async function parsePdfWithRetry(
  parse: IdeaPdfParser,
  buffer: Buffer,
  attempts: number,
  onRetry: (attempt: number, error: unknown) => void,
): Promise<ParsedIdeaPdfText> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await parse(buffer);
    } catch (error: unknown) {
      if (attempt >= attempts) throw error;
      onRetry(attempt, error);
    }
  }
}
