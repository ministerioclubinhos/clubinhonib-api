const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

const DOCUMENTS = [
  {
    name: 'Manual do Professor Voluntário',
    description: 'Guia completo para professores voluntários do Clubinho NIB. Contém orientações pedagógicas, regras de conduta e material de apoio.',
  },
  {
    name: 'Regimento Interno do Clubinho',
    description: 'Regras e regulamentos oficiais que regem o funcionamento dos Clubinhos NIB. Leitura obrigatória para coordenadores e professores.',
  },
  {
    name: 'Calendário Anual de Atividades',
    description: 'Calendário completo com todas as atividades, feriados e eventos especiais previstos para o ano letivo.',
  },
  {
    name: 'Formulário de Inscrição da Criança',
    description: 'Formulário oficial para inscrição de novas crianças no Clubinho. Deve ser preenchido pelo responsável legal.',
  },
  {
    name: 'Declaração de Responsabilidade dos Pais',
    description: 'Termo de responsabilidade que os pais ou responsáveis devem assinar ao inscrever a criança no Clubinho.',
  },
  {
    name: 'Plano Pedagógico Anual',
    description: 'Documento que descreve os objetivos pedagógicos, temas e metodologias que serão utilizados durante o ano letivo.',
  },
  {
    name: 'Relatório de Frequência - Modelo',
    description: 'Modelo padrão para registro de frequência semanal das crianças. Para uso dos professores durante os encontros.',
  },
  {
    name: 'Guia de Atividades Lúdicas',
    description: 'Coletânea de atividades, jogos e dinâmicas que podem ser utilizados nas aulas do Clubinho para tornar o aprendizado mais divertido.',
  },
  {
    name: 'Política de Proteção à Criança',
    description: 'Diretrizes e protocolos para garantir a segurança e proteção de todas as crianças que participam do Clubinho NIB.',
  },
  {
    name: 'Bíblia de Estudos para Crianças - Referências',
    description: 'Lista de referências bíblicas organizadas por tema para uso nas aulas do Clubinho. Inclui versículos para memorização.',
  },
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 5;

  // Verifica quantos documentos já existem
  let existing = 0;
  try {
    const listRes = await http.request('get', '/documents', { params: { page: 1, limit: 1 } });
    existing = listRes.data?.total ?? listRes.data?.meta?.totalItems ?? (Array.isArray(listRes.data) ? listRes.data.length : 0);
  } catch (_) {}

  const toCreate = Math.max(0, min - existing);
  logger.info(`[documents/create] garantindo mínimo ${min} documentos (atual=${existing}, criando=${toCreate})...`);

  let created = 0;
  for (let i = 0; i < toCreate; i++) {
    const doc = DOCUMENTS[i % DOCUMENTS.length];
    const docData = {
      name: `${doc.name}${i >= DOCUMENTS.length ? ` (${Math.floor(i / DOCUMENTS.length) + 1})` : ''}`,
      description: doc.description,
      media: {
        title: doc.name,
        description: doc.description,
        uploadType: 'upload',
        mediaType: 'document',
        isLocalFile: true,
        fileField: 'docFile',
      },
    };

    try {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/documents',
        fields: { documentData: JSON.stringify(docData) },
        files: {
          docFile: {
            filename: `${doc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.pdf`,
            contentType: 'application/pdf',
            content: Buffer.alloc(512, 0x00),
          },
        },
      });
      created++;
      logger.info(`[documents/create] +1 "${doc.name}"`);
      await sleep(40);
    } catch (e) {
      logger.warn(`[documents/create] falhou "${doc.name}": ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[documents/create] OK criados=${created}`);
  return { created };
}

module.exports = { run };
