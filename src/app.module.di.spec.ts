import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

/**
 * Sobe o grafo de injeção inteiro em modo *preview*.
 *
 * Preview monta o container e resolve as dependências de todos os providers sem
 * instanciar nenhum deles — então nada conecta no banco, no S3 ou no SMTP, e
 * ainda assim um `forwardRef` faltando, um provider redeclarado sem as
 * dependências novas ou um módulo que deixou de exportar algo derrubam o teste.
 *
 * Existe porque nem `npm run build` nem os testes unitários enxergam isso: as
 * suítes trocam cada colaborador por mock, então um serviço que ninguém
 * consegue construir passa verde e só quebra no boot da aplicação.
 */
describe('grafo de injeção da aplicação', () => {
  it('resolve as dependências de todos os providers', async () => {
    // `abortOnError: false` faz o Nest lançar em vez de chamar `process.exit`,
    // que derrubaria a execução inteira do jest em vez de reprovar este teste.
    const app = await NestFactory.create(AppModule, {
      preview: true,
      logger: false,
      abortOnError: false,
    });

    await app.init();
    await app.close();
  }, 60000);
});
