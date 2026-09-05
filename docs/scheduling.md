# Agendador

Jobs que rodam por horário, e não por requisição. `@nestjs/schedule` registra os
horários; o que decide se algo executa é a variável `SCHEDULER_ENABLED`.

Até aqui a API só reagia a requisições: todo e-mail sai porque alguém clicou em
algo. Um lembrete de semana furada ou um resumo de segunda-feira não tem
requisição que o dispare — é para isso que este módulo existe.

## Estrutura

```text
src/shared/scheduling/
├── scheduling.module.ts     # ScheduleModule.forRoot() e os jobs declarados
├── constants.ts             # fuso, horários e a chave que liga o agendador
├── types.ts                 # ScheduledJobName, JobRunResult e os enums
├── utils.ts                 # leitura da chave, formatação, mensagem de erro
├── job-runner.service.ts    # a engrenagem comum a todo job
└── jobs/
    └── scheduler-heartbeat.job.ts
```

## Como um job é escrito

Um job declara **quando** roda e **o que** faz. Tudo o que se repete entre eles
fica no `JobRunnerService`:

```ts
@Cron(JOB_SCHEDULES.meuJob, {
  name: ScheduledJobName.MeuJob,
  timeZone: SCHEDULING_TIMEZONE,
})
async handleCron(): Promise<void> {
  await this.jobRunner.run(ScheduledJobName.MeuJob, () =>
    this.meuServico.executar(),
  );
}
```

Três regras que valem para todos:

- **o job não implementa regra de negócio.** Ele chama o serviço do caso de uso,
  como um controller chamaria. Quem monta conteúdo de e-mail continua sendo
  `src/shared/email/` — veja [`email.md`](email.md);
- **o horário vai em `JOB_SCHEDULES`,** nunca solto no decorador: a pergunta "o
  que roda de madrugada?" tem que ser respondida sem abrir job por job;
- **o nome vai em `ScheduledJobName`.** É a chave da trava de concorrência e o
  que aparece no log.

## O que o runner garante

| Garantia                     | Por quê                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Desligado por padrão**     | Sem `SCHEDULER_ENABLED`, nada executa                                                                   |
| **Nunca derruba o processo** | O `@Cron` não tem a quem devolver um erro; se ele escapar, vira rejeição não tratada e leva a API junto |
| **Não se sobrepõe**          | Enquanto uma execução não termina, o disparo seguinte do mesmo job é dispensado                         |
| **Log com duração**          | Início, fim e aviso quando passa de `JOB_SLOW_RUN_MS`                                                   |

## `SCHEDULER_ENABLED` e o risco de aviso duplicado

O agendador é `@Cron` **em processo**: cada instância da API que sobe passa a
disparar os mesmos horários por conta própria. Com duas réplicas, todo aviso sai
duas vezes — e a pessoa que receber duas vezes o mesmo e-mail não vai supor que
foi escalonamento.

Enquanto não houver trava distribuída, a regra é ligar `SCHEDULER_ENABLED` em
**uma instância só**. Só `true` e `1` ligam; qualquer outro valor mantém
desligado, o que é o comportamento certo em máquina de desenvolvimento e na
suíte de testes.

O dia em que a API rodar em várias réplicas com jobs que mandam e-mail, isto
precisa virar uma trava no banco — uma linha por `(job, janela)` gravada com
chave única antes de executar. Não está feito.

## Fuso

`SCHEDULING_TIMEZONE` fixa `America/Sao_Paulo` para toda expressão. Nunca o fuso
do servidor: um contêiner em UTC dispararia o aviso das 8h para uma professora
às 5h da manhã.

## Jobs registrados

| Job                          | Quando         | O que faz                                                          |
| ---------------------------- | -------------- | ------------------------------------------------------------------ |
| `scheduler-heartbeat`        | Todo dia às 7h | Registra no log que o agendador acordou                            |
| `missing-pagela-reminder`    | Domingo às 8h  | Lembra cada clubinho das pagelas que faltaram na semana que fechou |
| `coordinator-weekly-summary` | Segunda às 8h  | Manda a cada coordenador o resumo dos clubinhos dele               |

### Por que domingo e segunda

Domingo nunca é dia de Clubinho, então no domingo de manhã a semana anterior
está fechada e nenhuma pagela dela chega mais a tempo. O lembrete vai às 8h e
não à meia-noite: um aviso de madrugada é lido junto com o spam da noite.

O resumo do coordenador sai um dia depois, e não junto: no domingo o professor
ainda pode lançar a pagela que faltou, e o resumo de segunda conta o que sobrou
— além de chegar quando o coordenador tem a semana pela frente para cobrar.

Os dois resolvem a semana pela data de um sábado (ontem no domingo, anteontem na
segunda) usando `toDateOnly`, que formata em horário local. `toISOString()`
adiantaria o dia depois das 21h em São Paulo e resolveria a semana errada.

Fora do período letivo os dois encerram sem enviar nada: não há pagela a cobrar
quando não há clubinho.

### O custo do levantamento

`ClubControlService.listClubsWithMissingPagela` roda `checkClubWeek` para cada
clubinho, e cada um faz cerca de quatro consultas. Com 100 clubinhos são ~400
consultas por disparo, uma vez por semana. O resumo do coordenador faz **um**
levantamento e o distribui entre todos — perguntar por coordenador multiplicaria
isso.

O heartbeat não manda e-mail nem toca no banco. Ele existe porque um agendador
que parou em produção é indistinguível de uma semana em que nada precisou ser
avisado, e serve de molde para os próximos jobs.
