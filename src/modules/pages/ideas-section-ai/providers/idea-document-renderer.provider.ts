import { Injectable } from '@nestjs/common';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { PdfLibreOfficeService } from 'src/modules/ai-lessons/services/pdf-libreoffice.service';
import {
  EnhancedIdeaDocumentDto,
  IdeaDocumentBlockType,
} from '../dto/enhanced-idea.dto';
import { RenderedIdeaDocument, ParsedIdeaPdf, IdeaPdfParser } from '../types';
import { createRequire } from 'node:module';
@Injectable()
export class IdeaDocumentRendererProvider {
  constructor(private readonly pdf: PdfLibreOfficeService) {}
  async inspect(buffer: Buffer): Promise<ParsedIdeaPdf> {
    // Import the parser entry directly: package index runs a sample PDF on require.
    const parse = createRequire(__filename)(
      'pdf-parse/lib/pdf-parse.js',
    ) as IdeaPdfParser;
    return parse(buffer);
  }
  async toPdf(buffer: Buffer, name: string): Promise<Buffer> {
    if (name.toLowerCase().endsWith('.pdf')) return buffer;
    return this.pdf.convertToPdf(
      buffer,
      name.toLowerCase().endsWith('.doc') ? '.doc' : '.docx',
    );
  }
  async render(
    document: EnhancedIdeaDocumentDto,
  ): Promise<RenderedIdeaDocument> {
    const children: Paragraph[] = [
      new Paragraph({
        text: 'Clubinho Bíblico • Nova Igreja Batista',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({ text: document.title, heading: HeadingLevel.TITLE }),
    ];
    for (const section of document.sections) {
      if (section.heading)
        children.push(
          new Paragraph({
            text: section.heading,
            heading: HeadingLevel.HEADING_1,
          }),
        );
      for (const block of section.blocks) {
        if (block.text)
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: block.text,
                  italics: block.type === IdeaDocumentBlockType.VERSE,
                }),
              ],
              spacing: { after: 160 },
            }),
          );
        for (const [index, item] of block.items.entries())
          children.push(
            new Paragraph({
              text:
                block.type === IdeaDocumentBlockType.NUMBERED_LIST
                  ? `${index + 1}. ${item}`
                  : item,
              ...(block.type === IdeaDocumentBlockType.BULLET_LIST
                ? { bullet: { level: 0 } }
                : {}),
              spacing: { after: 120 },
            }),
          );
      }
    }
    const docx = await Packer.toBuffer(
      new Document({ sections: [{ children }] }),
    );
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
    };
  }
}
