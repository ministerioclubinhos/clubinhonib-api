function getUniqueTimestamp() {
  return Date.now() + Math.floor(Math.random() * 10000);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  const firstNames = [
    'João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Julia', 'Lucas', 'Sofia',
    'Gabriel', 'Isabella', 'Rafael', 'Larissa', 'Felipe', 'Mariana', 'Bruno',
    'Camila', 'Thiago', 'Beatriz', 'Gustavo', 'Amanda', 'Henrique', 'Laura',
    'Matheus', 'Fernanda', 'Rodrigo', 'Patricia', 'André', 'Juliana', 'Ricardo',
    'Vanessa', 'Diego', 'Priscila', 'Leonardo', 'Aline', 'Marcos', 'Tatiane',
    'Victor', 'Renata', 'Eduardo', 'Daniela', 'Fabian', 'Leticia', 'Samuel',
    'Bruna', 'Leandro', 'Cristiane', 'Vitor', 'Sabrina', 'Caio', 'Nathalia',
  ];
  const lastNames = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Rodrigues',
    'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Fernandes', 'Carvalho', 'Gomes',
    'Martins', 'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Mendes', 'Barbosa',
    'Ferreira', 'Cardoso', 'Reis', 'Dias', 'Cavalcanti', 'Ramos', 'Freitas',
    'Moraes', 'Teixeira', 'Correia', 'Cunha', 'Moreira', 'Bezerra', 'Xavier',
    'Fonseca', 'Machado', 'Pinto', 'Vasconcelos', 'Azevedo', 'Castro', 'Lopes',
    'Campos', 'Batista', 'Borges', 'Melo', 'Cruz', 'Nunes', 'Vieira', 'Andrade',
  ];
  return `${pick(firstNames)} ${pick(lastNames)}`;
}

function randomChildName() {
  const boyNames = [
    'Davi', 'Arthur', 'Bernardo', 'Miguel', 'Heitor', 'Theo', 'Enzo', 'Lorenzo',
    'Nicolas', 'Mateus', 'Lucas', 'Gabriel', 'Pedro', 'Guilherme', 'Murilo',
    'Cauã', 'Kauã', 'Vitor', 'Samuel', 'Henrique', 'Luan', 'Raul', 'Ryan',
    'Isaac', 'Iago', 'Emanuel', 'Bento', 'Caleb', 'Elias', 'Daniel',
  ];
  const girlNames = [
    'Alice', 'Sophia', 'Helena', 'Valentina', 'Laura', 'Isabella', 'Manuela',
    'Giovanna', 'Beatriz', 'Larissa', 'Letícia', 'Clara', 'Luísa', 'Julia',
    'Carolina', 'Isabela', 'Fernanda', 'Rafaela', 'Lorena', 'Pietra',
    'Melissa', 'Esther', 'Camila', 'Cecília', 'Bianca', 'Rebeca', 'Lívia',
    'Emilly', 'Lara', 'Vitória',
  ];
  const allNames = [...boyNames, ...girlNames];
  const lastNames = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Rodrigues',
    'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Fernandes', 'Carvalho', 'Gomes',
    'Martins', 'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Mendes', 'Barbosa',
    'Ferreira', 'Cardoso', 'Reis', 'Dias', 'Batista', 'Melo', 'Cruz', 'Nunes',
    'Vieira',
  ];
  return { name: `${pick(allNames)} ${pick(lastNames)}`, gender: boyNames.includes(allNames[Math.floor(Math.random() * allNames.length)]) ? (Math.random() > 0.5 ? 'M' : 'F') : (Math.random() > 0.5 ? 'M' : 'F') };
}

function randomEmail(prefix = 'teste') {
  return `${prefix}.${getUniqueTimestamp()}@teste.clubinhonib.com`;
}

function randomPhone() {
  const ddd = ['11', '21', '31', '41', '47', '48', '51', '61', '71', '81', '85', '92', '27', '62', '91', '83', '98'];
  const number = Math.floor(900000000 + Math.random() * 99999999);
  return `${pick(ddd)}${number}`;
}

function randomBirthDate() {
  const year = 2010 + Math.floor(Math.random() * 12);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomJoinedAt(academicYear = 2025) {
  // Entre o início e o final do ano letivo
  const startDate = new Date(`${academicYear}-02-03`);
  const endDate = new Date(`${academicYear}-11-30`);
  const timeDiff = endDate.getTime() - startDate.getTime();
  const randomTime = Math.floor(Math.random() * timeDiff);
  const randomDate = new Date(startDate.getTime() + randomTime);
  const year = randomDate.getFullYear();
  const month = String(randomDate.getMonth() + 1).padStart(2, '0');
  const day = String(randomDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomGender() {
  return Math.random() > 0.5 ? 'M' : 'F';
}

function randomClubNumber() {
  return Math.floor(1000 + Math.random() * 9000);
}

function randomWeekday() {
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return pick(weekdays);
}

function randomTime() {
  const hours = ['08', '09', '10', '14', '15', '16', '17', '18', '19'];
  const minutes = ['00', '30'];
  return `${pick(hours)}:${pick(minutes)}`;
}

function randomAddress() {
  const streets = [
    'Rua das Flores', 'Avenida Principal', 'Rua Central', 'Avenida Brasil',
    'Rua do Comércio', 'Avenida Paulista', 'Rua da Paz', 'Avenida dos Estados',
    'Rua São Paulo', 'Avenida Getúlio Vargas', 'Rua das Palmeiras', 'Rua Sete de Setembro',
    'Avenida Brasil', 'Rua Dom Pedro II', 'Rua Tiradentes', 'Avenida Independência',
    'Rua XV de Novembro', 'Rua João Pessoa', 'Avenida Goiás', 'Rua Marechal Deodoro',
  ];
  const districts = [
    'Centro', 'Jardim das Flores', 'Vila Nova', 'Bairro Novo', 'Parque Industrial',
    'Alto da Boa Vista', 'São José', 'Nova Esperança', 'Jardim América', 'Vila Rica',
    'Setor Sul', 'Setor Norte', 'Jardim Goiás', 'Vila Operária', 'Setor Central',
    'Bela Vista', 'Jardim Primavera', 'Vila Verde', 'Residencial das Flores', 'Setor Leste',
  ];
  const cities = [
    'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre',
    'Brasília', 'Salvador', 'Manaus', 'Fortaleza', 'Recife', 'Goiânia', 'Belém',
    'Florianópolis', 'Maceió', 'Natal', 'Campo Grande', 'Teresina', 'João Pessoa',
    'Aracaju', 'Porto Velho',
  ];
  const states = [
    'SP', 'RJ', 'MG', 'PR', 'RS', 'DF', 'BA', 'AM', 'CE', 'PE',
    'GO', 'PA', 'SC', 'AL', 'RN', 'MS', 'PI', 'PB', 'SE', 'RO',
  ];

  const cityIdx = Math.floor(Math.random() * cities.length);

  return {
    street: `${pick(streets)}, ${Math.floor(Math.random() * 2999) + 1}`,
    number: String(Math.floor(Math.random() * 9999) + 1),
    district: pick(districts),
    city: cities[cityIdx],
    state: states[cityIdx],
    postalCode: String(Math.floor(10000000 + Math.random() * 90000000)).replace(/(\d{5})(\d{3})/, '$1-$2'),
    complement: Math.random() > 0.6 ? `${pick(['Apto', 'Sala', 'Casa'])} ${Math.floor(Math.random() * 500) + 1}` : undefined,
  };
}

function randomComment() {
  const comments = [
    'O Clubinho transformou a vida do meu filho! Ele está muito mais alegre e comunicativo.',
    'Excelente trabalho dos professores. As crianças adoram participar das atividades.',
    'Minha filha espera toda semana pelo dia do Clubinho. É incrível ver o crescimento dela!',
    'As atividades são muito bem planejadas e as crianças aprendem de forma divertida.',
    'Estou muito satisfeita com o desenvolvimento espiritual e social da minha criança.',
    'O Clubinho é um espaço seguro e amoroso para as crianças. Recomendo a todos!',
    'Meu filho fez amizades incríveis no Clubinho. A turma é muito unida.',
    'As histórias bíblicas são contadas de forma que as crianças entendem e se identificam.',
    'Os professores são dedicados e carinhosos. Dá para ver o amor que têm pelas crianças.',
    'Nossa família está muito grata pelo Clubinho. Mudou muito a nossa semana!',
    'As músicas e atividades são ótimas. Meu filho chega em casa cantando os versículos!',
    'Excelente ambiente para as crianças aprenderem sobre Deus de forma lúdica.',
    'Parabéns pelo trabalho! O nível de organização e cuidado é admirável.',
    'Minha filha ficou muito curiosa para saber mais sobre a Bíblia depois do Clubinho.',
    'As amizades formadas no Clubinho são para a vida toda. Obrigado pelo trabalho!',
  ];
  return pick(comments);
}

function randomNeighborhood() {
  const neighborhoods = [
    'Centro', 'Jardim das Flores', 'Vila Nova', 'Setor Sul', 'Alto da Boa Vista',
    'São José', 'Nova Esperança', 'Jardim América', 'Vila Rica', 'Bela Vista',
    'Jardim Primavera', 'Vila Verde', 'Setor Leste', 'Setor Norte', 'Vila Operária',
    'Parque Industrial', 'Residencial das Flores', 'Setor Central', 'Jardim Goiás', 'Setor Oeste',
  ];
  return pick(neighborhoods);
}

function randomContactMessage() {
  const messages = [
    'Gostaria de saber mais informações sobre o Clubinho NIB e como meu filho pode participar.',
    'Tenho interesse em colaborar como voluntário nas atividades do Clubinho.',
    'Preciso de informações sobre o horário e local do Clubinho mais próximo de mim.',
    'Minha filha tem 8 anos e gostaria de saber se existe vaga no Clubinho da minha região.',
    'Como posso me cadastrar como professor voluntário do Clubinho?',
    'Gostaria de entender melhor como funcionam as atividades semanais do Clubinho.',
    'Há algum Clubinho no bairro da Vila Nova? Gostaria de inscrever meu filho.',
    'Quero saber mais sobre o projeto e como posso apoiar financeiramente.',
    'Tenho interesse em abrir um novo Clubinho no meu bairro. Como proceder?',
    'Minha criança participou de um evento do Clubinho e ficou encantada. Como faço para frequentar?',
  ];
  return pick(messages);
}

function randomSiteFeedback() {
  const feedbacks = [
    { comment: 'O site está muito bem organizado e fácil de navegar. Parabéns!', rating: 5 },
    { comment: 'Ótimo site! Encontrei tudo o que precisava rapidamente.', rating: 5 },
    { comment: 'Interface bonita e intuitiva. Gostei muito do design.', rating: 4 },
    { comment: 'O site carrega rápido e as informações são claras.', rating: 5 },
    { comment: 'Muito bom! Fácil de usar mesmo pelo celular.', rating: 4 },
    { comment: 'Site bem estruturado. Seria bom ter mais fotos das atividades.', rating: 4 },
    { comment: 'Gostei do site, mas algumas páginas poderiam ter mais conteúdo.', rating: 3 },
    { comment: 'Excelente plataforma! Consigo acompanhar as atividades do meu filho facilmente.', rating: 5 },
    { comment: 'O site é muito útil para acompanhar as informações do Clubinho.', rating: 4 },
    { comment: 'Poderia ter um calendário de eventos mais visível na página inicial.', rating: 3 },
  ];
  return pick(feedbacks);
}

module.exports = {
  pick,
  randomName,
  randomChildName,
  randomEmail,
  randomPhone,
  randomBirthDate,
  randomJoinedAt,
  randomGender,
  randomClubNumber,
  randomWeekday,
  randomTime,
  randomAddress,
  randomComment,
  randomNeighborhood,
  randomContactMessage,
  randomSiteFeedback,
};
