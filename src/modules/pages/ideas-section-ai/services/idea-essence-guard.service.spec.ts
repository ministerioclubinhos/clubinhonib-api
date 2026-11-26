import { IdeaEssenceGuardService } from './idea-essence-guard.service';
import { EnhanceIdeaTextService } from './enhance-idea-text.service';
import { IdeaAiGatewayProvider } from '../providers/idea-ai-gateway.provider';
import { settings } from '../testing/fixtures';
import { checkIdeaDocumentStructure } from '../utils';
import {
  EnhancedIdeaDocumentDto,
  IdeaDocumentBlockType,
} from '../dto/enhanced-idea.dto';

describe('essence guard and approved text projection', () => {
  const json = jest.fn();
  const gateway = { json } as unknown as IdeaAiGatewayProvider;
  const guard = new IdeaEssenceGuardService(gateway);
  beforeEach(() => jest.resetAllMocks());
  it('rejects deterministic changes before calling the judge', async () => {
    await expect(
      guard.verify(settings, 'Use 3 bolas.', 'Use 4 bolas.'),
    ).resolves.toMatchObject({ approved: false });
    expect(json).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'honors the second judge approval=%s',
    async (approved) => {
      json.mockResolvedValue({ preservesEssence: approved, violations: [] });
      await expect(
        guard.verify(settings, 'Use 3 bolas.', 'Separe 3 bolas.'),
      ).resolves.toMatchObject({ approved });
    },
  );
  it.each([true, false])(
    'exposes text only when the guard approves=%s',
    async (approved) => {
      json.mockResolvedValue({
        title: 'Gincana',
        description: 'Separe 3 bolas.',
        changes: [],
      });
      const verifier = {
        verify: jest.fn().mockResolvedValue({ approved, violations: [] }),
      };
      const service = new EnhanceIdeaTextService(
        gateway,
        verifier as unknown as IdeaEssenceGuardService,
      );
      const result = await service.enhance(settings, 'Gincana', 'Use 3 bolas.');
      expect(result.title).toBe(approved ? 'Gincana' : null);
      expect(result.description).toBe(approved ? 'Separe 3 bolas.' : null);
    },
  );
  it('detects removed activities and changes in numbered steps', () => {
    const document: EnhancedIdeaDocumentDto = {
      title: 'Ideia',
      hasEssentialVisuals: false,
      preservedFacts: [],
      sections: [
        {
          heading: 'Atividade 1',
          blocks: [
            {
              type: IdeaDocumentBlockType.NUMBERED_LIST,
              text: '',
              items: ['Prepare.', 'Brinque.'],
            },
          ],
        },
      ],
    };
    expect(
      checkIdeaDocumentStructure(
        'Ideia\nAtividade 1\n1. Prepare.\n2. Brinque.',
        document,
      ).approved,
    ).toBe(true);
    expect(
      checkIdeaDocumentStructure('Atividade 1\nAtividade 2', document).approved,
    ).toBe(false);
    expect(
      checkIdeaDocumentStructure(
        'Atividade 1\n1. Prepare.\n2. Brinque.\n3. Termine.',
        document,
      ).approved,
    ).toBe(false);
  });
});
