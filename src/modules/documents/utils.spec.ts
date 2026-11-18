import { AppValidationException } from 'src/shared/exceptions';
import { assertAcceptedDocumentFile } from './utils';

const file = (originalname: string, mimetype: string) =>
  ({ originalname, mimetype }) as Express.Multer.File;

const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

describe('assertAcceptedDocumentFile', () => {
  it.each([
    ['aula.pdf', 'application/pdf'],
    ['Aula.PDF', 'application/pdf'],
    ['texto.docx', DOCX],
    ['slides.pptx', PPTX],
    ['slides.pptx', 'application/octet-stream'],
  ])('aceita %s (%s)', (name, mime) => {
    expect(() => assertAcceptedDocumentFile(file(name, mime))).not.toThrow();
  });

  it.each([
    ['velho.doc', 'application/msword'],
    ['apresentacao.ppt', 'application/vnd.ms-powerpoint'],
    ['script.exe', 'application/octet-stream'],
    ['falso.pdf', 'text/html'],
    ['sem-extensao', 'application/pdf'],
  ])('recusa %s (%s)', (name, mime) => {
    expect(() => assertAcceptedDocumentFile(file(name, mime))).toThrow(
      AppValidationException,
    );
  });

  it('sem arquivo novo não valida nada (edição só de metadados)', () => {
    expect(() => assertAcceptedDocumentFile(undefined)).not.toThrow();
  });
});
