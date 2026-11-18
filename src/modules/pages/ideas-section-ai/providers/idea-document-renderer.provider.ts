import { Injectable } from '@nestjs/common';
import { PdfLibreOfficeService } from 'src/modules/ai-lessons/services/pdf-libreoffice.service';
import type { EnhancedIdeaDocumentDto } from '../dto/enhanced-idea.dto';
import { ideaDocumentToTiptap } from '../idea-document.utils';
import {
  IdeaPdfParser,
  IdeaTiptapDocument,
  ParsedIdeaPdf,
  RenderedIdeaDocument,
} from '../types';
import { IdeaTiptapDocxProvider } from './idea-tiptap-docx.provider';
import { createRequire } from 'node:module';
import { IDEA_AI } from '../constants';
import { countPdfImages } from '../pdf-images.utils';
@Injectable()
export class IdeaDocumentRendererProvider {
  constructor(
    private readonly pdf: PdfLibreOfficeService,
    private readonly tiptap: IdeaTiptapDocxProvider,
  ) {}
  /** Texto, páginas e imagens embutidas do PDF, sem IA e sem renderizar nada. */
  async inspect(buffer: Buffer): Promise<ParsedIdeaPdf> {
    // Import the parser entry directly: package index runs a sample PDF on require.
    const parse = createRequire(__filename)(
      'pdf-parse/lib/pdf-parse.js',
    ) as IdeaPdfParser;
    const images = countPdfImages(buffer, IDEA_AI.embeddedImageMinPixels);
    try {
      return { ...(await parse(buffer)), images };
    } catch (error: unknown) {
      // O leitor de texto estoura em alguns PDFs com imagem (ex.: "bad XRef
      // entry"). Com imagens de verdade o documento é mantido como enviado;
      // sem elas, o erro continua sendo um erro.
      if (images > 0) return { text: '', numpages: 0, images };
      throw error;
    }
  }
  async toPdf(buffer: Buffer, name: string): Promise<Buffer> {
    if (name.toLowerCase().endsWith('.pdf')) return buffer;
    return this.pdf.convertToPdf(
      buffer,
      name.toLowerCase().endsWith('.doc') ? '.doc' : '.docx',
    );
  }
  /** Documento estruturado da IA → DOCX editável + PDF, pelo mesmo caminho do editor. */
  render(document: EnhancedIdeaDocumentDto): Promise<RenderedIdeaDocument> {
    return this.renderTiptap(ideaDocumentToTiptap(document));
  }

  /** Conteúdo do editor (gerado pela IA ou editado à mão) → DOCX + PDF. */
  async renderTiptap(
    document: IdeaTiptapDocument,
  ): Promise<RenderedIdeaDocument> {
    const docx = await this.tiptap.toDocx(document);
    const pdf = await this.pdf.convertDocxToPdf(docx);
    return {
      artifact: {
        buffer: pdf,
        name: 'ideia-melhorada.pdf',
        mimeType: 'application/pdf',
      },
      editable: {
        buffer: docx,
        name: 'ideia-melhorada.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      document,
    };
  }
}
