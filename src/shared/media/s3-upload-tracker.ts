/**
 * Guarda as URLs enviadas ao S3 durante uma operação para que, se ela falhar no
 * meio, os arquivos que não chegaram a ser referenciados possam ser apagados.
 *
 * O upload acontece fora da transação do banco: sem esse registro, uma falha
 * depois do envio deixaria o arquivo no bucket para sempre.
 */
export class S3UploadTracker {
  private readonly urls: string[] = [];

  constructor(
    private readonly uploadFn: (file: Express.Multer.File) => Promise<string>,
  ) {}

  /** Envia o arquivo e registra a URL resultante. */
  readonly upload = async (file: Express.Multer.File): Promise<string> => {
    const url = await this.uploadFn(file);
    this.urls.push(url);
    return url;
  };

  /** URLs enviadas até agora, na ordem em que foram criadas. */
  get uploadedUrls(): string[] {
    return [...this.urls];
  }
}
