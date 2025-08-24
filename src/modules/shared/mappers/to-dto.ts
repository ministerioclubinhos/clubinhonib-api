import { plainToInstance } from 'class-transformer';

export function toDto<T, E>(cls: new () => T, entity: E): T {
  return plainToInstance(cls, entity as object, { excludeExtraneousValues: true });
}

export function toDtoArray<T, E>(cls: new () => T, entities: E[]): T[] {
  return entities.map(e => toDto(cls, e));
}
