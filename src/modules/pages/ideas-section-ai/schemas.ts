import { IdeaDocumentBlockType, IdeaImageKind } from './dto/enhanced-idea.dto';
const string = { type: 'string' };
const strings = { type: 'array', items: string };
function object(properties: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}
export const IDEA_TEXT_SCHEMA = object({
  title: string,
  description: string,
  changes: strings,
});
export const IDEA_JUDGE_SCHEMA = object({
  preservesEssence: { type: 'boolean' },
  violations: strings,
});
export const IDEA_IMAGE_SCHEMA = object({
  containsPeople: { type: 'boolean' },
  containsText: { type: 'boolean' },
  kind: { type: 'string', enum: Object.values(IdeaImageKind) },
  qualityIssues: strings,
});
export const IDEA_DOCUMENT_SCHEMA = object({
  title: string,
  hasEssentialVisuals: { type: 'boolean' },
  preservedFacts: strings,
  sections: {
    type: 'array',
    items: object({
      heading: string,
      blocks: {
        type: 'array',
        items: object({
          type: { type: 'string', enum: Object.values(IdeaDocumentBlockType) },
          text: string,
          items: strings,
        }),
      },
    }),
  },
});
