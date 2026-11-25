import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';

/** Um item do array `imports`: módulo, módulo dinâmico ou `forwardRef`. */
type ModuleRef = unknown;

/** Resolve `forwardRef(() => X)` para o módulo apontado. */
const resolve = (entry: ModuleRef): unknown => {
  if (entry && typeof entry === 'object' && 'forwardRef' in entry) {
    const lazy = (entry as { forwardRef: () => unknown }).forwardRef;
    return typeof lazy === 'function' ? lazy() : undefined;
  }
  return entry;
};

const importsOf = (module: unknown): ModuleRef[] =>
  (Reflect.getMetadata('imports', module as object) as ModuleRef[]) ?? [];

const nameOf = (module: unknown): string =>
  typeof module === 'function' ? module.name : String(module);

/**
 * Percorre o grafo de módulos e junta os que não resolvem.
 *
 * Um import que chega como `undefined` derruba o boot com
 * `UndefinedModuleException`, e isso não aparece em type-check nem em build:
 * é o ciclo de `require` entre dois módulos que só se manifesta em execução.
 * O caminho até o import quebrado vai na mensagem.
 */
const findBrokenImports = (
  root: unknown,
): { path: string; index: number }[] => {
  const broken: { path: string; index: number }[] = [];
  const visited = new Set<unknown>();

  const walk = (module: unknown, path: string[]): void => {
    if (!module || visited.has(module)) return;
    visited.add(module);

    const trail = [...path, nameOf(module)];

    importsOf(module).forEach((entry, index) => {
      const resolved = resolve(entry);

      if (!resolved) {
        broken.push({ path: trail.join(' -> '), index });
        return;
      }

      // Um módulo dinâmico (`forRoot`/`forFeature`) traz o alvo em `module`.
      const target =
        typeof resolved === 'object' &&
        resolved !== null &&
        'module' in resolved
          ? (resolved as { module: unknown }).module
          : resolved;

      if (typeof target === 'function') walk(target, trail);
    });
  };

  walk(root, []);
  return broken;
};

/**
 * Entidades registradas na conexão raiz do TypeORM.
 *
 * A lista mora em `src/database/entities.ts` porque o `DataSource` do CLI de
 * migration precisa exatamente das mesmas: gerar a partir de um conjunto
 * diferente do que a aplicação usa produziria um diff inventado.
 */
const registeredEntities = (): string[] => {
  const source = readFileSync(
    join(__dirname, 'database', 'entities.ts'),
    'utf8',
  );
  const block =
    /DATABASE_ENTITIES\s*=\s*\[([\s\S]*?)\]/.exec(source)?.[1] ?? '';
  return block
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

/** Todas as classes marcadas com `@Entity` no código. */
const declaredEntities = (): string[] => {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, item.name);
      if (item.isDirectory()) {
        walk(full);
        continue;
      }
      if (!item.name.endsWith('.ts') || item.name.endsWith('.spec.ts'))
        continue;

      const source = readFileSync(full, 'utf8');
      if (!source.includes('@Entity(')) continue;

      for (const match of source.matchAll(/export class (\w+)/g)) {
        found.push(match[1]);
      }
    }
  };

  walk(__dirname);
  return found;
};

describe('entidades do TypeORM', () => {
  it('toda entidade está registrada na conexão', () => {
    // A conexão declara as entidades uma a uma. Uma entidade nova fora dessa
    // lista não ganha tabela e quebra o `forFeature` do módulo dono dela — e
    // nada disso aparece em build ou type-check.
    const registered = new Set(registeredEntities());
    const missing = declaredEntities().filter(
      (entity) => !registered.has(entity),
    );

    expect(missing).toEqual([]);
  });
});

/**
 * Rotas deliberadamente abertas (sem sessão), com o motivo.
 *
 * A conferência é rota a rota: um controller com uma única rota protegida não
 * pode esconder outra aberta — foi assim que `POST /accepted-christs` deixou
 * qualquer pessoa gravar que uma criança aceitou a Jesus.
 */
const INTENTIONALLY_PUBLIC_ROUTES: Record<string, string> = {
  'AppController.getHello': 'raiz da API',
  'AppController.getHealth': 'sonda de saúde',
  'AuthController.login': 'entrada',
  'AuthController.googleLogin': 'entrada',
  'AuthController.refresh': 'autorizado pelo refresh token',
  'AuthController.completeRegister': 'cadastro',
  'AuthController.register': 'cadastro',
  'AuthController.forgotPassword': 'recuperação de senha',
  'AuthController.verifyEmail': 'autorizado pelo token do e-mail',
  'AuthController.resendVerification': 'cadastro ainda sem sessão',
  'AuthController.validateResetToken': 'autorizado pelo token do e-mail',
  'AuthController.resetPassword': 'autorizado pelo token do e-mail',
  'FeatureFlagsController.getFlagsMap': 'o site monta o menu antes do login',
  'FeatureFlagsController.check': 'o site consulta antes do login',
  'EmailPreferencesController.unsubscribe':
    'descadastro pelo link do e-mail; quem autoriza é o token assinado',
  'CommentController.findPublished': 'depoimentos publicados na home',
  'ContactController.create': 'formulário de contato do site público',
  'DocumentsController.findOne': 'documento aberto por página pública',
  'FeedPhotoCommentsController.published': 'comentários aprovados da galeria',
  'EventController.findAll': 'agenda pública',
  'EventController.findUpcoming': 'agenda pública',
  'EventController.findOne': 'agenda pública',
  'IdeasPageController.findOne': 'página aberta por link compartilhado',
  'ImageController.getPaginatedSections': 'galeria pública de fotos',
  'ImageController.findOne': 'galeria pública de fotos',
  'VideosPageController.findOne': 'galeria pública de vídeos',
  'RouteController.findAll': 'mapa de rotas que o site monta antes do login',
  'RouteController.findOne': 'mapa de rotas que o site monta antes do login',
};

/** Metadados que o Nest grava com `@Controller`, `@Get` e `@UseGuards`. */
const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';
const GUARDS_METADATA = '__guards__';

/** Todos os arquivos de controller do código. */
const controllerFiles = (dir: string = __dirname): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = join(dir, item.name);
    if (item.isDirectory()) return controllerFiles(full);
    return item.name.endsWith('.controller.ts') ? [full] : [];
  });

const hasGuards = (target: object): boolean =>
  ((Reflect.getMetadata(GUARDS_METADATA, target) as unknown[]) ?? []).length >
  0;

/** `Controller.método` de toda rota sem guard na classe nem no método. */
const openRoutes = (): string[] =>
  controllerFiles()
    .flatMap((file) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Object.values(require(file) as Record<string, unknown>),
    )
    .filter(
      (exported): exported is { name: string; prototype: object } =>
        typeof exported === 'function' &&
        Reflect.getMetadata(PATH_METADATA, exported) !== undefined,
    )
    .filter((controller) => !hasGuards(controller))
    .flatMap((controller) =>
      Object.getOwnPropertyNames(controller.prototype)
        .filter((key) => key !== 'constructor')
        .filter((key) => {
          const handler = Object.getOwnPropertyDescriptor(
            controller.prototype,
            key,
          )?.value as unknown;
          return (
            typeof handler === 'function' &&
            Reflect.getMetadata(METHOD_METADATA, handler) !== undefined &&
            !hasGuards(handler)
          );
        })
        .map((key) => `${controller.name}.${key}`),
    )
    .sort();

describe('guardas dos controllers', () => {
  it('toda rota tem guarda, salvo as públicas declaradas', () => {
    expect(
      openRoutes().filter((route) => !(route in INTENTIONALLY_PUBLIC_ROUTES)),
    ).toEqual([]);
  });

  it('a lista de públicas não guarda rota que já ganhou guarda', () => {
    // Um nome que sobra aqui deixaria a rota voltar a ser aberta sem aviso.
    const open = new Set(openRoutes());

    expect(
      Object.keys(INTENTIONALLY_PUBLIC_ROUTES).filter(
        (route) => !open.has(route),
      ),
    ).toEqual([]);
  });
});

describe('repositório', () => {
  it('nenhum arquivo de src/ é escondido pelo .gitignore', () => {
    // `audit` sem âncora ignorou o módulo `core/audit` inteiro: a aplicação
    // compilava na máquina de quem escreveu e quebrava em um clone limpo.
    const ignored = execFileSync(
      'git',
      ['ls-files', '--others', '--ignored', '--exclude-standard', '--', '.'],
      { cwd: __dirname, encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);

    expect(ignored).toEqual([]);
  });
});

describe('grafo de módulos', () => {
  it('não tem import indefinido em nenhum módulo alcançável', () => {
    // Cada ciclo entre módulos precisa de forwardRef nos dois lados; sem isso,
    // um dos lados recebe `undefined` e a aplicação não sobe.
    expect(findBrokenImports(AppModule)).toEqual([]);
  });
});
