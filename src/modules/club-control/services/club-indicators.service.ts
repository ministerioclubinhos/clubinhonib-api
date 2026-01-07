import { Injectable } from '@nestjs/common';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { ClubExceptionEntity } from '../entities/club-exception.entity';

@Injectable()
export class ClubIndicatorsService {
  generateIndicators(
    status: string,
    hasException: boolean,
    exception: ClubExceptionEntity | null,
    hasPassedClubDay: boolean,
    totalChildren: number,
    childrenWithPagela: number,
    childrenMissing: number,
    inactiveChildren: ChildEntity[],
    completionRate: number,
    missingRate: number,
  ): any[] {
    const indicators: any[] = [];

    if (inactiveChildren.length > 0) {
      indicators.push({
        type: 'children_not_attending',
        severity: 'warning',
        message: `⚠️ ${inactiveChildren.length} criança(s) que não frequentam mais os clubinhos`,
        details: {
          totalChildren: inactiveChildren.length,
          childrenList: inactiveChildren.map((c) => ({
            childId: c.id,
            childName: c.name,
            isActive: c.isActive,
            reason: 'Criança desativada',
          })),
          note: 'Crianças desativadas não entram nos indicadores positivos nem negativos, apenas neste indicador',
        },
      });
    }

    if (hasException) {
      indicators.push({
        type: 'exception',
        severity: 'info',
        message: `ℹ️ Exceção global: ${exception!.reason}`,
        details: {
          exceptionDate: exception!.exceptionDate,
          reason: exception!.reason,
          type: exception!.type,
          isRecurrent: exception!.isRecurrent,
          totalChildren,
          childrenWithPagela,
          childrenMissing,
          note: 'Pagelas não são obrigatórias nesta data devido à exceção cadastrada',
        },
      });
      return indicators;
    }

    if (status === 'ok') {
      if (totalChildren > 0) {
        indicators.push({
          type: 'all_ok',
          severity: 'success',
          message: `✅ Todas as ${totalChildren} crianças tiveram pagela`,
          details: {
            totalChildren,
            childrenWithPagela,
            childrenMissing,
            completionRate: Math.round(completionRate * 10) / 10,
            missingRate: 0,
            isPerfect: true,
          },
        });
      }
    } else if (status === 'pending') {
    } else if (status === 'partial') {
      if (hasPassedClubDay) {
        indicators.push({
          type: 'some_missing',
          severity: 'warning',
          message: `⚠️ ${childrenMissing} de ${totalChildren} crianças SEM pagela (${Math.round(missingRate)}% faltando)`,
          details: {
            totalChildren,
            childrenWithPagela,
            childrenMissing,
            completionRate: Math.round(completionRate * 10) / 10,
            missingRate: Math.round(missingRate * 10) / 10,
            isPerfect: false,
            needsAttention: true,
            urgency:
              missingRate > 50 ? 'high' : missingRate > 25 ? 'medium' : 'low',
          },
        });
      }
    } else if (status === 'missing') {
      if (hasPassedClubDay) {
        if (totalChildren > 0) {
          indicators.push({
            type: 'no_pagela',
            severity: 'critical',
            message: `🔴 NENHUMA pagela registrada (${totalChildren} crianças esperadas)`,
            details: {
              totalChildren,
              childrenWithPagela: 0,
              childrenMissing,
              completionRate: 0,
              missingRate: 100,
              isPerfect: false,
              needsAttention: true,
              urgency: 'critical',
              lastPagelaDate: null,
            },
          });
        } else {
          indicators.push({
            type: 'no_children',
            severity: 'warning',
            message: `⚠️ Clubinho sem crianças cadastradas`,
            details: {
              totalChildren: 0,
              childrenWithPagela: 0,
              childrenMissing: 0,
              completionRate: 0,
              missingRate: 0,
              isPerfect: false,
              needsAttention: false,
              urgency: 'low',
              possibleIssue:
                'Clubinho pode estar inativo ou sem configuração de crianças',
            },
          });
        }
      }
    }

    return indicators;
  }

  generateInactiveClubIndicators(
    allChildren: ChildEntity[],
    childrenNotAttending: ChildEntity[],
  ): any[] {
    return [
      {
        type: 'club_inactive',
        severity: 'info',
        message: `ℹ️ Clubinho desativado`,
        details: {
          totalChildren: allChildren.length,
          childrenNotAttending: childrenNotAttending.length,
          note: 'Todas as crianças deste clubinho (ativas e inativas) entram no indicador de "crianças que não frequentam mais os clubinhos"',
        },
      },
      {
        type: 'children_not_attending',
        severity: 'warning',
        message: `⚠️ ${childrenNotAttending.length} criança(s) que não frequentam mais os clubinhos`,
        details: {
          totalChildren: childrenNotAttending.length,
          childrenList: childrenNotAttending.map((c) => ({
            childId: c.id,
            childName: c.name,
            isActive: c.isActive,
            reason: 'Clubinho desativado',
          })),
          note: 'Todas as crianças deste clubinho desativado são consideradas como não frequentando mais',
        },
      },
    ];
  }
}
