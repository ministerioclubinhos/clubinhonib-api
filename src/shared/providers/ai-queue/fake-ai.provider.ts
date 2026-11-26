import { appendFile, mkdir, stat, truncate } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  AI_FAKE_JOURNAL_MAX_BYTES,
  AI_FAKE_JOURNAL_PATH,
  AI_FAKE_MAX_COUNTERS,
  AI_FAKE_SLOW_MS,
} from './constants';
import { AiFakeScenario } from './enums';
import {
  aiFakeJournalLine,
  aiFakeTransportError,
  applyAiFakeResponseFault,
  findAiFakeFault,
} from './fake-ai-faults.utils';
import { fakeAiResponse } from './fake-ai-response.utils';
import { AiFakeFault, AiQueueRequest, AiQueueResponse } from './types';

/**
 * O provedor simulado do modo `fake`: responde no formato real, encena as falhas
 * pedidas por marcador e registra cada pedido para conferência dos prompts.
 */
export class FakeAiProvider {
  private readonly calls = new Map<string, number>();

  constructor(
    private readonly journalPath: string | null = resolve(
      process.cwd(),
      AI_FAKE_JOURNAL_PATH,
    ),
    private readonly slowMs: number = AI_FAKE_SLOW_MS,
  ) {}

  async respond(request: AiQueueRequest): Promise<AiQueueResponse> {
    const fault = this.activeFault(request);
    await this.record(request, fault?.scenario ?? null);

    if (!fault) return fakeAiResponse(request);

    const error = aiFakeTransportError(request, fault.scenario);
    if (error) throw error;

    if (fault.scenario === AiFakeScenario.SLOW)
      await new Promise<void>((done) => setTimeout(done, this.slowMs));

    return applyAiFakeResponseFault(fakeAiResponse(request), fault.scenario);
  }

  /** O cenário que vale para esta chamada, respeitando o número de vezes. */
  private activeFault(request: AiQueueRequest): AiFakeFault | null {
    const fault = findAiFakeFault(request);
    if (!fault || fault.times === null) return fault;

    const used = this.calls.get(fault.marker) ?? 0;
    if (this.calls.size >= AI_FAKE_MAX_COUNTERS) this.calls.clear();
    this.calls.set(fault.marker, used + 1);

    return used < fault.times ? fault : null;
  }

  /** O diário é auxiliar: falhar ao gravar não muda a resposta simulada. */
  private async record(
    request: AiQueueRequest,
    scenario: AiFakeScenario | null,
  ): Promise<void> {
    if (!this.journalPath) return;
    try {
      await mkdir(dirname(this.journalPath), { recursive: true });
      const size = await stat(this.journalPath).then(
        (file) => file.size,
        () => 0,
      );
      if (size > AI_FAKE_JOURNAL_MAX_BYTES) await truncate(this.journalPath);
      await appendFile(this.journalPath, aiFakeJournalLine(request, scenario));
    } catch {
      /* Sem diário: a simulação continua. */
    }
  }
}
