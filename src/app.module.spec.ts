import 'reflect-metadata';
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

describe('grafo de módulos', () => {
  it('não tem import indefinido em nenhum módulo alcançável', () => {
    // Cada ciclo entre módulos precisa de forwardRef nos dois lados; sem isso,
    // um dos lados recebe `undefined` e a aplicação não sobe.
    expect(findBrokenImports(AppModule)).toEqual([]);
  });
});
