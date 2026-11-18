/**
 * Garante, no banco LOCAL, a flag `idea_ai_enhancement` criada e ligada.
 *
 * Chamado pelo `./run.sh local` antes de subir a API, para o fluxo de melhoria
 * das ideias por IA ficar disponível no desenvolvimento. Ligada, cada ideia
 * enviada localmente chama o provedor de IA configurado (gasta tokens).
 *
 * Usa o `DataSource` do CLI, que recusa qualquer `DB_HOST` não local. Para
 * desligar, use o painel de feature flags.
 */
import dataSource from 'src/database/data-source';
import { DEFAULT_FEATURE_FLAGS } from 'src/core/feature-flags/constants';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { FeatureFlagEntity } from 'src/core/feature-flags/entities/feature-flag.entity';

const KEY: string = FeatureFlagKeys.IDEA_AI_ENHANCEMENT;

async function main(): Promise<void> {
  const seed = DEFAULT_FEATURE_FLAGS.find((flag) => flag.key === KEY);
  if (!seed) throw new Error(`A flag ${KEY} não está no catálogo de fábrica.`);
  await dataSource.initialize();
  try {
    const flags = dataSource.getRepository(FeatureFlagEntity);
    const existing = await flags.findOneBy({ key: KEY });
    if (!existing) {
      await flags.save(
        flags.create({
          key: seed.key,
          name: seed.name,
          description: seed.description,
          enabled: true,
          targetRoles: [...seed.targetRoles],
        }),
      );
      process.stdout.write(`flag ${KEY} criada e ligada\n`);
      return;
    }
    if (existing.enabled) {
      process.stdout.write(`flag ${KEY} já ligada\n`);
      return;
    }
    await flags.update({ key: KEY }, { enabled: true });
    process.stdout.write(`flag ${KEY} ligada\n`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Falha ao preparar a flag.'}\n`,
  );
  process.exitCode = 1;
});
