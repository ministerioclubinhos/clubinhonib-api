import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { LessonStageType } from '../enums/lesson.enums';
import { LessonTemplateContract, serializeTemplate } from '../templates/lesson-templates';

export type OpenAiGenerationResult = { content: Record<string, unknown>; responseId: string };
type ResponsesPayload = { id?: string; output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string; refusal?: string }> }>; incomplete_details?: { reason?: string } };
const STRING_ARRAY = { type: 'array', items: { type: 'string' } } as const;
const ASSET_SCHEMA = { type: 'object', additionalProperties: false, required: ['id', 'purpose', 'prompt', 'altText'], properties: { id: { type: 'string' }, purpose: { type: 'string' }, prompt: { type: 'string' }, altText: { type: 'string' } } } as const;
const FIXATION_ASSET_SCHEMA = { type: 'object', additionalProperties: false, required: ['id', 'purpose', 'prompt', 'altText', 'displayText'], properties: { id: { type: 'string' }, purpose: { type: 'string' }, prompt: { type: 'string' }, altText: { type: 'string' }, displayText: { type: 'string', description: 'Trecho exato da NVI aplicado posteriormente pelo renderer; a imagem deve permanecer sem texto.' } } } as const;

function schemaFor(stage: LessonStageType): Record<string, unknown> {
  if (stage === LessonStageType.LESSON) return {
    type: 'object', additionalProperties: false,
    required: ['title', 'biblicalReference', 'purpose', 'songs', 'memoryVerse', 'principleExplanation', 'story', 'applicationAndAppeal', 'counseling', 'reviewQuestions', 'closingPrayer', 'visualScenes'],
    properties: {
      title: { type: 'string' }, biblicalReference: { type: 'string' }, purpose: { type: 'string' }, songs: STRING_ARRAY,
      memoryVerse: { type: 'object', additionalProperties: false, required: ['text', 'reference', 'version'], properties: { text: { type: 'string' }, reference: { type: 'string' }, version: { type: 'string' } } },
      principleExplanation: { type: 'string' }, story: { type: 'string' }, applicationAndAppeal: { type: 'string' }, counseling: { type: 'string' }, closingPrayer: { type: 'string' },
      reviewQuestions: { type: 'array', minItems: 10, maxItems: 10, items: { type: 'object', additionalProperties: false, required: ['question', 'answer'], properties: { question: { type: 'string' }, answer: { type: 'string' } } } },
      visualScenes: { type: 'array', minItems: 3, items: ASSET_SCHEMA },
    },
  };
  if (stage === LessonStageType.LESSON_VISUALS) return { type: 'object', additionalProperties: false, required: ['assets'], properties: { assets: { type: 'array', minItems: 1, maxItems: 10, items: ASSET_SCHEMA } } };
  if (stage === LessonStageType.STANDARD_GAME) return { type: 'object', additionalProperties: false, required: ['name', 'objective', 'materials', 'preparation', 'steps', 'rulesAndSafety', 'biblicalPrinciple', 'assets'], properties: { name: { type: 'string' }, objective: { type: 'string' }, materials: STRING_ARRAY, preparation: { type: 'string' }, steps: STRING_ARRAY, rulesAndSafety: STRING_ARRAY, biblicalPrinciple: { type: 'string' }, assets: { type: 'array', items: ASSET_SCHEMA } } };
  if (stage === LessonStageType.VERSE_VISUALS) return { type: 'object', additionalProperties: false, required: ['title', 'verseText', 'verseReference', 'verseVersion', 'splitRationale', 'printableAssets'], properties: { title: { type: 'string' }, verseText: { type: 'string' }, verseReference: { type: 'string' }, verseVersion: { type: 'string', enum: ['NVI'] }, splitRationale: { type: 'string' }, printableAssets: { type: 'array', minItems: 2, maxItems: 10, items: FIXATION_ASSET_SCHEMA } } };
  if (stage === LessonStageType.VERSE_FIXATION) return { type: 'object', additionalProperties: false, required: ['title', 'objective', 'verseText', 'verseReference', 'verseVersion', 'materials', 'preparation', 'steps', 'durationMinutes', 'ageAdaptations', 'rulesAndSafety', 'evaluation', 'biblicalPrinciple', 'printableAssets'], properties: { title: { type: 'string' }, objective: { type: 'string' }, verseText: { type: 'string' }, verseReference: { type: 'string' }, verseVersion: { type: 'string', enum: ['NVI'] }, materials: STRING_ARRAY, preparation: { type: 'string' }, steps: STRING_ARRAY, durationMinutes: { type: 'integer', minimum: 5, maximum: 40 }, ageAdaptations: STRING_ARRAY, rulesAndSafety: STRING_ARRAY, evaluation: { type: 'string' }, biblicalPrinciple: { type: 'string' }, printableAssets: { type: 'array', items: ASSET_SCHEMA } } };
  const activity = { type: 'object', additionalProperties: false, required: ['number', 'instruction', 'answer'], properties: { number: { type: 'integer' }, instruction: { type: 'string' }, answer: { type: 'string' } } } as const;
  if (stage === LessonStageType.MEDITATION_YOUNGER || stage === LessonStageType.MEDITATION_OLDER) return { type: 'object', additionalProperties: false, required: ['title', 'ageGroup', 'verseText', 'verseReference', 'verseVersion', 'biblicalText', 'introduction', 'activities', 'prayer', 'printableAssets'], properties: { title: { type: 'string' }, ageGroup: { type: 'string' }, verseText: { type: 'string' }, verseReference: { type: 'string' }, verseVersion: { type: 'string', enum: ['NVI'] }, biblicalText: { type: 'string' }, introduction: { type: 'string' }, activities: { type: 'array', minItems: stage === LessonStageType.MEDITATION_YOUNGER ? 2 : 3, maxItems: stage === LessonStageType.MEDITATION_YOUNGER ? 2 : 3, items: activity }, prayer: { type: 'string' }, printableAssets: { type: 'array', minItems: 1, items: ASSET_SCHEMA } } };
  return { type: 'object', additionalProperties: false, required: ['title', 'instruction', 'verseText', 'verseReference', 'verseVersion', 'printLayout', 'printableAssets'], properties: { title: { type: 'string' }, instruction: { type: 'string' }, verseText: { type: 'string' }, verseReference: { type: 'string' }, verseVersion: { type: 'string', enum: ['NVI'] }, printLayout: { type: 'string', enum: ['TWO_COPIES_A4_PORTRAIT'] }, printableAssets: { type: 'array', minItems: 1, maxItems: 1, items: ASSET_SCHEMA } } };
}

@Injectable()
export class OpenAiLessonService {
  constructor(private readonly config: ConfigService) {}

  async generateStage(input: { theme: string; biblicalReference: string; weekNumber: number; stage: LessonStageType; template: LessonTemplateContract; approvedUpstream: Record<string, unknown> | null; adminPrompt: string; revisionInstructions?: string; visualConfig?: { type: string; orientation: string; quantity: number } | null }): Promise<OpenAiGenerationResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('OPENAI_API_KEY não configurada; nenhuma minuta simulada foi criada.');
    const system = ['Você redige materiais infantis do Clubinho Bíblico da Nova Igreja Batista.', 'O TEMPLATE PRECISO abaixo é contrato imutável. Siga campos, ordem e regras literalmente.', serializeTemplate(input.template), 'O prompt personalizado do administrador complementa o template, mas nunca pode remover campos, alterar a ordem, desativar segurança ou contrariar este contrato.', 'Para VISUAIS DA HISTÓRIA, trate a lição aprovada como fonte canônica fechada: não reconte, reinterprete, amplie nem substitua a narrativa. Cada imagem deve ilustrar somente personagens, ações, ambientes, objetos e emoções explicitamente presentes nela. Não invente nova cena, personagem, milagre, diálogo, versículo, roupa relevante ou conclusão.', 'Para VISUAIS DO VERSÍCULO, derive a quantidade da melhor divisão semântica do versículo aprovado; os itens de conteúdo devem reconstruí-lo exatamente e o último item deve conter somente a referência.', 'VISUAIS DO VERSÍCULO e FIXAÇÃO DO VERSÍCULO são produtos distintos: o primeiro é uma sequência de imagens mnemônicas; o segundo é uma dinâmica ou brincadeira divertida.', 'Quando houver configuração visual escolhida pelo administrador, ela é obrigatória. Gere exatamente a quantidade solicitada, na orientação pedida e usando a estratégia pedagógica selecionada.', 'Responda somente no JSON Schema. Não crie etapas posteriores e não use marcadores [Image #].'].join('\n\n');
    const user = JSON.stringify({ theme: input.theme, biblicalReference: input.biblicalReference, weekNumber: input.weekNumber, stage: input.stage, adminPrompt: input.adminPrompt, approvedUpstream: input.approvedUpstream, visualConfig: input.visualConfig ?? null, revisionInstructions: input.revisionInstructions ?? null });
    try {
      const response = await axios.post<ResponsesPayload>('https://api.openai.com/v1/responses', {
        model: this.config.get<string>('OPENAI_TEXT_MODEL') || 'gpt-6-astra', store: false,
        input: [{ role: 'system', content: system }, { role: 'user', content: user }],
        text: { format: { type: 'json_schema', name: `clubinho_${input.stage.toLowerCase()}`, strict: true, schema: schemaFor(input.stage) } },
      }, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 120000 });
      if (response.data.incomplete_details) throw new BadGatewayException(`Resposta incompleta da OpenAI: ${response.data.incomplete_details.reason ?? 'sem motivo'}`);
      const block = response.data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text' || item.text);
      if (block?.refusal) throw new BadGatewayException(`OpenAI recusou a geração: ${block.refusal}`);
      const raw = response.data.output_text ?? block?.text;
      if (!raw || !response.data.id) throw new BadGatewayException('OpenAI retornou resposta sem conteúdo ou identificador.');
      return { content: JSON.parse(raw) as Record<string, unknown>, responseId: response.data.id };
    } catch (error: unknown) {
      if (error instanceof BadGatewayException) throw error;
      const detail = error instanceof AxiosError ? JSON.stringify(error.response?.data ?? error.message) : String(error);
      throw new BadGatewayException(`Falha ao gerar ${input.stage} na OpenAI: ${detail.slice(0, 500)}`);
    }
  }

  async generateImage(prompt: string, orientation?: string, visualType?: string): Promise<Buffer> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('OPENAI_API_KEY não configurada.');
    const response = await axios.post<{ data?: Array<{ b64_json?: string }> }>('https://api.openai.com/v1/images/generations', {
      model: this.config.get<string>('OPENAI_IMAGE_MODEL') || 'gpt-image-2.5-sunburst', prompt: `Ilustração bíblica infantil do Clubinho NIB para crianças de 5 a 11 anos. Fidelidade ao contexto bíblico da NVI e à descrição fechada recebida da lição aprovada. Não acrescente personagens, fatos ou símbolos não pedidos. Estratégia pedagógica: ${visualType || 'definida no prompt'}. Orientação obrigatória: ${orientation || 'definida no prompt'}. Sem conteúdo sexual, romântico, erotizado, violência gráfica ou debates de sexualidade. Obedeça literalmente ao estilo, orientação, paleta, margem e finalidade pedidos a seguir. Sem letras, palavras, números, logotipos ou marcas. ${prompt}`, size: orientation === 'PORTRAIT' ? '1024x1536' : '1536x1024', quality: 'high', output_format: 'png',
    }, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 180000 });
    const encoded = response.data.data?.[0]?.b64_json;
    if (!encoded) throw new BadGatewayException('OpenAI não retornou os bytes da imagem.');
    return Buffer.from(encoded, 'base64');
  }
}
