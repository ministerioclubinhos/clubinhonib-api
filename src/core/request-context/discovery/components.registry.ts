import { Injectable, OnModuleInit, Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';

import { UNKNOWN_MODULE_NAME } from '../constants';
import { DiscoveredComponent } from '../types';

/**
 * Mapa imutável `componente -> módulo`, construído uma vez a partir do
 * container do Nest.
 *
 * É o que dá a cada log e a cada ação o módulo de origem sem lista manual: um
 * módulo novo entra pelo container e o teste arquitetural compara o grafo real
 * com este mapa.
 */
@Injectable()
export class ComponentsRegistry implements OnModuleInit {
  private readonly byClass = new Map<Type<unknown>, DiscoveredComponent>();
  private readonly byName = new Map<string, DiscoveredComponent>();
  private readonly modules = new Set<string>();
  private unknownContexts = 0;

  constructor(private readonly modulesContainer: ModulesContainer) {}

  onModuleInit(): void {
    this.build();
  }

  /** Reconstrói o mapa; idempotente, para os testes chamarem direto. */
  build(): void {
    this.byClass.clear();
    this.byName.clear();
    this.modules.clear();

    for (const module of this.modulesContainer.values()) {
      const moduleName = module.metatype?.name;
      if (!moduleName) continue;
      this.modules.add(moduleName);

      for (const wrapper of module.controllers.values()) {
        this.register(wrapper.metatype, wrapper.name, moduleName, 'controller');
      }
      for (const wrapper of module.providers.values()) {
        this.register(wrapper.metatype, wrapper.name, moduleName, 'provider');
      }
    }
  }

  moduleNames(): string[] {
    return [...this.modules].sort();
  }

  components(): DiscoveredComponent[] {
    return [...this.byClass.values()];
  }

  moduleOf(target: Type<unknown> | string | null | undefined): string {
    if (!target) return this.unknown();
    const found =
      typeof target === 'string'
        ? this.byName.get(target)
        : (this.byClass.get(target) ?? this.byName.get(target.name));
    return found?.moduleName ?? this.unknown();
  }

  /** Quantas vezes um `context` de log ficou sem módulo conhecido. */
  get unknownContextCount(): number {
    return this.unknownContexts;
  }

  private unknown(): string {
    this.unknownContexts += 1;
    return UNKNOWN_MODULE_NAME;
  }

  private register(
    metatype: unknown,
    name: unknown,
    moduleName: string,
    kind: DiscoveredComponent['kind'],
  ): void {
    if (typeof metatype !== 'function') return;
    const componentName =
      typeof name === 'string' && name
        ? name
        : (metatype as Type<unknown>).name;
    if (!componentName) return;
    const component: DiscoveredComponent = { componentName, moduleName, kind };
    // O primeiro módulo que declara a classe é o dono; reexportações não
    // mudam a origem.
    if (!this.byClass.has(metatype as Type<unknown>)) {
      this.byClass.set(metatype as Type<unknown>, component);
    }
    if (!this.byName.has(componentName)) {
      this.byName.set(componentName, component);
    }
  }
}
