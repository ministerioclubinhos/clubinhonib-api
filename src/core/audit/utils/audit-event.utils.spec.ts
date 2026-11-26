import { AuditHttpMethod, AuditOutcome } from '../enums';
import {
  extractIdFromResult,
  isAuditedHttpMethod,
  extractResourceIdFromParams,
  httpActionName,
  httpMethodOf,
  joinRoutePaths,
  outcomeFromStatus,
} from './audit-event.utils';

describe('outcomeFromStatus', () => {
  it.each([
    [200, AuditOutcome.Succeeded],
    [201, AuditOutcome.Succeeded],
    [401, AuditOutcome.Denied],
    [403, AuditOutcome.Denied],
    [404, AuditOutcome.NotFound],
    [400, AuditOutcome.Rejected],
    [409, AuditOutcome.Rejected],
    [422, AuditOutcome.Rejected],
    [500, AuditOutcome.Failed],
  ])('%d -> %s', (status, outcome) =>
    expect(outcomeFromStatus(status)).toBe(outcome),
  );
});

describe('isAuditedHttpMethod', () => {
  it.each([
    ['POST', true],
    ['put', true],
    ['PATCH', true],
    ['DELETE', true],
    ['GET', false],
    ['HEAD', false],
    ['OPTIONS', false],
    [null, false],
  ])('%s -> %s', (method, expected) =>
    expect(isAuditedHttpMethod(method)).toBe(expected),
  );
});

describe('httpMethodOf', () => {
  it('normaliza e recusa desconhecido', () => {
    expect(httpMethodOf('patch')).toBe(AuditHttpMethod.PATCH);
    expect(httpMethodOf('PROPFIND')).toBeNull();
    expect(httpMethodOf(null)).toBeNull();
  });
});

describe('extractResourceIdFromParams', () => {
  it('só nomes allowlisted e só identificadores seguros', () => {
    expect(extractResourceIdFromParams({ id: 'a1-b2' })).toBe('a1-b2');
    expect(extractResourceIdFromParams({ clubId: 'c', id: 'x' })).toBe('x');
    expect(extractResourceIdFromParams({ year: '2026' })).toBeNull();
    expect(extractResourceIdFromParams({ id: 'com espaço' })).toBeNull();
    expect(extractResourceIdFromParams({ id: 'x'.repeat(200) })).toBeNull();
    expect(extractResourceIdFromParams(undefined)).toBeNull();
  });
});

describe('extractIdFromResult', () => {
  it('apenas `id` string do topo', () => {
    expect(extractIdFromResult({ id: 'novo' })).toBe('novo');
    expect(extractIdFromResult({ user: { id: 'x' } })).toBeNull();
    expect(extractIdFromResult({ id: 12 })).toBeNull();
    expect(extractIdFromResult('texto')).toBeNull();
  });
});

describe('httpActionName / joinRoutePaths', () => {
  it('monta o nome automático e a rota template', () => {
    expect(httpActionName('ClubsModule', 'ClubsController', 'create')).toBe(
      'ClubsModule.ClubsController.create',
    );
    expect(httpActionName(null, 'C', 'h')).toBe('unknown-module.C.h');
    expect(httpActionName('M', null, 'h')).toBeNull();
    expect(joinRoutePaths('clubs', ':id/toggle-active')).toBe(
      '/clubs/:id/toggle-active',
    );
    expect(joinRoutePaths('/', '/')).toBe('/');
    expect(joinRoutePaths(['a', 'b'], undefined)).toBe('/a/b');
  });
});
