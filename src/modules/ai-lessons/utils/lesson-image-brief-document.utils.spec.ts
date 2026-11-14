import { withoutLeakedImageBrief } from './lesson-image-brief-document.utils';
import { lessonContentToTiptap } from './lesson-tiptap.utils';

const heading = (text: string, level: number) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});
const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

describe('brief de imagem fora do documento do professor', () => {
  it('remove a seção IMAGE BRIEF vazada em versões antigas', () => {
    const doc = {
      type: 'doc',
      content: [
        heading('PRINCÍPIO BÍBLICO', 2),
        paragraph('Jesus nos chama a ouvir.'),
        heading('IMAGE BRIEF', 2),
        heading('ART DIRECTION', 3),
        paragraph('Infográfico infantil vertical.'),
        heading('PARTS', 3),
        paragraph('compilado-01'),
      ],
    };
    expect(withoutLeakedImageBrief(doc).content).toEqual([
      heading('PRINCÍPIO BÍBLICO', 2),
      paragraph('Jesus nos chama a ouvir.'),
    ]);
  });

  it('preserva o que vem depois do brief no mesmo nível', () => {
    const doc = {
      type: 'doc',
      content: [
        heading('IMAGE BRIEF', 2),
        paragraph('interno'),
        heading('PRINCÍPIO BÍBLICO', 2),
        paragraph('Depois de brincar.'),
      ],
    };
    expect(withoutLeakedImageBrief(doc).content).toEqual([
      heading('PRINCÍPIO BÍBLICO', 2),
      paragraph('Depois de brincar.'),
    ]);
  });

  it('não mexe em documentos sem brief nem em valores que não são documentos', () => {
    const doc = { type: 'doc', content: [paragraph('ok')] };
    expect(withoutLeakedImageBrief(doc)).toBe(doc);
    expect(withoutLeakedImageBrief(null)).toBeNull();
  });

  it('não gera mais a seção do brief ao montar o documento editável', () => {
    const doc = lessonContentToTiptap({
      name: 'Revezamento',
      biblicalPrinciple: 'Ouça e responda.',
      imageBrief: { artDirection: 'Infográfico', parts: [] },
    });
    expect(JSON.stringify(doc)).not.toContain('IMAGE BRIEF');
    expect(JSON.stringify(doc)).not.toContain('Infográfico');
    expect(JSON.stringify(doc)).toContain('Revezamento');
  });
});
