/**
 * Script de Criação de Dados em Massa
 * Cria dados aleatórios para todas as entidades
 * 
 * Para executar:
 * node scripts/run-all-testes.js
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const SUPERUSER_EMAIL = 'superuser@clubinhonib.com';
const SUPERUSER_PASSWORD = 'Abc@123';

let authToken = '';

// ============================================
// GERADORES DE DADOS ALEATÓRIOS
// ============================================

function getUniqueTimestamp() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function randomName() {
  const firstNames = ['João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Julia', 'Lucas', 'Sofia', 'Gabriel', 'Isabella', 'Rafael', 'Larissa', 'Felipe', 'Mariana', 'Bruno', 'Camila', 'Thiago', 'Beatriz', 'Gustavo', 'Amanda', 'Henrique', 'Laura', 'Matheus', 'Fernanda', 'Rodrigo', 'Patricia', 'André', 'Juliana', 'Ricardo', 'Vanessa'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Mendes', 'Barbosa', 'Ferreira', 'Cardoso', 'Reis', 'Dias', 'Cavalcanti', 'Ramos', 'Freitas', 'Moraes', 'Teixeira'];
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

function randomEmail(prefix = 'teste') {
  return `${prefix}.${getUniqueTimestamp()}@teste.clubinhonib.com`;
}

function randomPhone() {
  const ddd = ['11', '21', '31', '41', '47', '48', '51', '61', '71', '81', '85', '92'];
  const number = Math.floor(100000000 + Math.random() * 900000000);
  return `${ddd[Math.floor(Math.random() * ddd.length)]}${number}`;
}

function randomBirthDate() {
  const year = 2010 + Math.floor(Math.random() * 11);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomJoinedAt() {
  // Data aleatória entre 2020-01-01 e hoje
  const startDate = new Date('2020-01-01');
  const endDate = new Date();
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
  return weekdays[Math.floor(Math.random() * weekdays.length)];
}

function randomTime() {
  const hour = String(Math.floor(Math.random() * 24)).padStart(2, '0');
  const minute = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  return `${hour}:${minute}`;
}

function randomAddress() {
  const streets = ['Rua das Flores', 'Avenida Principal', 'Rua Central', 'Avenida Brasil', 'Rua do Comércio', 'Avenida Paulista', 'Rua da Paz', 'Avenida dos Estados', 'Rua São Paulo', 'Avenida Getúlio Vargas'];
  const districts = ['Centro', 'Jardim das Flores', 'Vila Nova', 'Bairro Novo', 'Parque Industrial', 'Alto da Boa Vista', 'São José', 'Nova Esperança', 'Jardim América', 'Vila Rica'];
  const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Brasília', 'Salvador', 'Manaus', 'Fortaleza', 'Recife'];
  const states = ['SP', 'RJ', 'MG', 'PR', 'RS', 'DF', 'BA', 'AM', 'CE', 'PE'];
  
  return {
    street: streets[Math.floor(Math.random() * streets.length)],
    number: String(Math.floor(Math.random() * 9999) + 1),
    district: districts[Math.floor(Math.random() * districts.length)],
    city: cities[Math.floor(Math.random() * cities.length)],
    state: states[Math.floor(Math.random() * states.length)],
    postalCode: String(Math.floor(10000000 + Math.random() * 90000000)),
    complement: Math.random() > 0.5 ? `Apto ${Math.floor(Math.random() * 500) + 1}` : undefined,
  };
}

function randomRole() {
  const roles = ['teacher', 'coordinator', 'admin'];
  return roles[Math.floor(Math.random() * roles.length)];
}

function randomDecision() {
  const decisions = ['ACCEPTED', 'RECONCILED'];
  return decisions[Math.floor(Math.random() * decisions.length)];
}

// ============================================
// HELPERS
// ============================================

async function login() {
  console.log('\n🔐 Fazendo login...');
  const response = await axios.post(`${API_BASE_URL}/auth/login`, {
    email: SUPERUSER_EMAIL,
    password: SUPERUSER_PASSWORD,
  });
  
  authToken = response.data.accessToken;
  console.log('✅ Login realizado com sucesso\n');
  return authToken;
}

async function authenticatedRequest(method, path, data = null) {
  const config = {
    method,
    url: `${API_BASE_URL}${path}`,
    headers: { Authorization: `Bearer ${authToken}` },
  };
  
  if (data) {
    if (method === 'get') {
      config.params = data;
    } else {
      config.data = data;
    }
  }
  
  return axios(config);
}

// ============================================
// CRIAÇÃO DE DADOS EM MASSA
// ============================================

async function createUsersInBulk(count = 20) {
  console.log(`\n👥 Criando ${count} usuários...`);
  const users = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const role = randomRole();
      const user = {
        name: randomName(),
        email: randomEmail(role),
        password: 'Senha123@',
        phone: randomPhone(),
        role: role,
        active: Math.random() > 0.2,
        completed: Math.random() > 0.3,
        commonUser: Math.random() > 0.5,
      };
      
      const response = await authenticatedRequest('post', '/users', user);
      users.push(response.data);
      process.stdout.write(`  ✅ Usuário ${i + 1}/${count}: ${user.name} (${role})\n`);
    } catch (error) {
      console.error(`  ❌ Erro ao criar usuário ${i + 1}:`, error.response?.data?.message || error.message);
    }
  }
  
  console.log(`✅ ${users.length} usuários criados\n`);
  return users;
}

async function createClubsInBulk(count = 10) {
  console.log(`\n🏢 Criando ${count} clubes...`);
  const clubs = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const club = {
        number: randomClubNumber(),
        weekday: randomWeekday(),
        time: Math.random() > 0.2 ? randomTime() : undefined,
        isActive: Math.random() > 0.2,
        address: randomAddress(),
      };
      
      const response = await authenticatedRequest('post', '/clubs', club);
      clubs.push(response.data);
      process.stdout.write(`  ✅ Clube ${i + 1}/${count}: Nº${club.number} (${club.weekday})\n`);
    } catch (error) {
      console.error(`  ❌ Erro ao criar clube ${i + 1}:`, error.response?.data?.message || error.message);
    }
  }
  
  console.log(`✅ ${clubs.length} clubes criados\n`);
  return clubs;
}

async function createChildrenInBulk(clubs, countPerClub = 10) {
  console.log(`\n👶 Criando ${countPerClub} crianças por clube (${clubs.length} clubes)...`);
  const children = [];
  let totalCreated = 0;
  
  for (const club of clubs) {
    console.log(`\n  📍 Clube ${club.number}:`);
    for (let i = 0; i < countPerClub; i++) {
      try {
        const child = {
          name: randomName(),
          birthDate: randomBirthDate(),
          guardianName: randomName(),
          gender: randomGender(),
          guardianPhone: randomPhone(),
          joinedAt: randomJoinedAt(), // Sempre incluir "No clubinho desde"
          isActive: Math.random() > 0.2,
          clubId: club.id,
          address: Math.random() > 0.3 ? randomAddress() : undefined,
        };
        
        const response = await authenticatedRequest('post', '/children', child);
        children.push(response.data);
        totalCreated++;
        process.stdout.write(`    ✅ Criança ${i + 1}/${countPerClub}: ${child.name} (desde ${child.joinedAt})\n`);
      } catch (error) {
        console.error(`    ❌ Erro ao criar criança ${i + 1}:`, error.response?.data?.message || error.message);
      }
    }
  }
  
  console.log(`\n✅ ${totalCreated} crianças criadas\n`);
  return children;
}

async function updateChildrenWithoutJoinedAt() {
  console.log(`\n📅 Verificando e atualizando crianças sem "No clubinho desde" (joinedAt)...`);
  
  let page = 1;
  const limit = 100;
  let totalUpdated = 0;
  let totalChecked = 0;
  let totalPages = 1;
  
  // Primeiro, buscar para saber quantas páginas temos
  try {
    const firstResponse = await authenticatedRequest('get', '/children', { page: 1, limit });
    totalPages = firstResponse.data.meta?.totalPages || 1;
    const totalItems = firstResponse.data.meta?.totalItems || 0;
    console.log(`  📊 Total de páginas: ${totalPages} (${totalItems} crianças no total)`);
  } catch (error) {
    console.error('  ❌ Erro ao buscar informações:', error.response?.data?.message || error.message);
    return 0;
  }
  
  // Processar todas as páginas
  while (page <= totalPages) {
    try {
      const response = await authenticatedRequest('get', '/children', { page, limit });
      const children = response.data.data || [];
      const meta = response.data.meta;
      
      if (children.length === 0) break;
      
      let pageUpdated = 0;
      
      for (const child of children) {
        totalChecked++;
        
        // Verificar se não tem joinedAt ou se está null/undefined
        if (!child.joinedAt || child.joinedAt === null || child.joinedAt === 'null') {
          try {
            const joinedAt = randomJoinedAt();
            await authenticatedRequest('put', `/children/${child.id}`, {
              joinedAt: joinedAt,
            });
            totalUpdated++;
            pageUpdated++;
            
            if (totalUpdated % 50 === 0) {
              process.stdout.write(`  ✅ ${totalUpdated} crianças atualizadas...\n`);
            }
          } catch (error) {
            console.error(`  ❌ Erro ao atualizar criança ${child.id}:`, error.response?.data?.message || error.message);
          }
        }
      }
      
      if (pageUpdated > 0) {
        console.log(`  📄 Página ${page}/${totalPages}: ${pageUpdated} crianças atualizadas (${children.length} verificadas)`);
      }
      
      if (page >= meta.totalPages) break;
      page++;
      
      // Pequeno delay para não sobrecarregar a API
      if (page <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error(`  ❌ Erro ao buscar crianças (página ${page}):`, error.response?.data?.message || error.message);
      break;
    }
  }
  
  console.log(`\n  ✅ ${totalUpdated} crianças atualizadas (de ${totalChecked} verificadas)`);
  console.log(`  ✅ ${totalChecked - totalUpdated} crianças já tinham joinedAt\n`);
  return totalUpdated;
}

async function createAcceptedChristsInBulk(children, percentage = 0.3) {
  console.log(`\n✝️ Criando accepted christs para ${Math.floor(children.length * percentage)} crianças...`);
  const acceptedChrists = [];
  const count = Math.floor(children.length * percentage);
  const selectedChildren = children.sort(() => Math.random() - 0.5).slice(0, count);
  
  for (let i = 0; i < selectedChildren.length; i++) {
    try {
      const child = selectedChildren[i];
      const acceptedChrist = {
        childId: child.id,
        decision: randomDecision(),
        notes: `Criado automaticamente - ${new Date().toISOString()}`,
      };
      
      const response = await axios.post(`${API_BASE_URL}/accepted-christs`, acceptedChrist);
      acceptedChrists.push(response.data);
      process.stdout.write(`  ✅ Accepted Christ ${i + 1}/${count}: ${child.name}\n`);
    } catch (error) {
      // Ignorar se já existe
      if (error.response?.status !== 400 && error.response?.status !== 409) {
        console.error(`  ❌ Erro ao criar accepted christ ${i + 1}:`, error.response?.data?.message || error.message);
      }
    }
  }
  
  console.log(`✅ ${acceptedChrists.length} accepted christs criados\n`);
  return acceptedChrists;
}

async function createPagelasInBulk(children, weeks = 48) {
  console.log(`\n📝 Criando pagelas para ${children.length} crianças (${weeks} semanas cada)...`);
  let totalCreated = 0;
  
  // Buscar período letivo de 2025
  let period = null;
  try {
    const periodResponse = await authenticatedRequest('get', '/club-control/periods/2025');
    period = periodResponse.data;
    console.log(`  📅 Período letivo 2025: ${period.startDate} a ${period.endDate}\n`);
  } catch (error) {
    console.log('  ⚠️ Período letivo 2025 não encontrado. Criando...');
    try {
      const createPeriodResponse = await authenticatedRequest('post', '/club-control/periods', {
        year: 2025,
        startDate: '2025-02-03',
        endDate: '2025-12-15',
        description: 'Ano Letivo 2025',
        isActive: true,
      });
      period = createPeriodResponse.data;
      console.log(`  ✅ Período letivo 2025 criado: ${period.startDate} a ${period.endDate}\n`);
    } catch (err) {
      console.error('  ❌ Erro ao criar período letivo:', err.response?.data?.message || err.message);
      return;
    }
  }
  
  // Função para calcular data da semana
  function getDateForWeek(period, week, weekday) {
    const startDate = new Date(period.startDate + 'T00:00:00');
    const getWeekStart = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.setDate(diff));
    };
    
    const periodWeekStart = getWeekStart(startDate);
    const weekStart = new Date(periodWeekStart);
    weekStart.setDate(periodWeekStart.getDate() + (week - 1) * 7);
    
    const weekdayMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const targetWeekday = weekdayMap[weekday] || 1;
    const currentWeekday = weekStart.getDay() || 7;
    const diff = targetWeekday - currentWeekday;
    weekStart.setDate(weekStart.getDate() + diff);
    
    return weekStart.toISOString().split('T')[0];
  }
  
  // Buscar clubes para obter weekday
  const clubsResponse = await authenticatedRequest('get', '/clubs/all');
  const clubs = clubsResponse.data;
  const clubMap = new Map(clubs.map(c => [c.id, c]));
  
  for (const child of children) {
    const club = clubMap.get(child.clubId || child.club?.id);
    const weekday = club?.weekday || 'saturday';
    
    console.log(`  👶 ${child.name}:`);
    let created = 0;
    
    for (let week = 1; week <= weeks; week++) {
      try {
        const referenceDate = getDateForWeek(period, week, weekday);
        const present = Math.random() > 0.2; // 80% presença
        const didMeditation = present && Math.random() > 0.3;
        const recitedVerse = present && Math.random() > 0.4;
        
        await authenticatedRequest('post', '/pagelas', {
          childId: child.id,
          referenceDate: referenceDate,
          week: week,
          year: 2025,
          present: present,
          didMeditation: didMeditation,
          recitedVerse: recitedVerse,
          notes: present ? `Semana ${week} - ${present ? 'Presente' : 'Ausente'}` : null,
        });
        
        created++;
        totalCreated++;
        
        if (week % 10 === 0) {
          process.stdout.write(`    Semana ${week}... `);
        }
      } catch (error) {
        // Ignorar erros de duplicação ou fora do período
        if (error.response?.status !== 400 && error.response?.status !== 409 && error.response?.status !== 404) {
          console.error(`\n    ❌ Erro semana ${week}:`, error.response?.data?.message || error.message);
        }
      }
    }
    
    console.log(`\n    ✅ ${created} pagelas criadas`);
  }
  
  console.log(`\n✅ Total: ${totalCreated} pagelas criadas\n`);
}

async function ensureTeachersForClubs(clubs, minTeachersPerClub = 10) {
  console.log(`\n👨‍🏫 Verificando e garantindo professores para clubes (mínimo ${minTeachersPerClub} por clube)...`);
  
  // Buscar todos os teacher profiles disponíveis
  let allTeachers = [];
  try {
    const teachersResponse = await authenticatedRequest('get', '/teacher-profiles', { page: 1, limit: 1000 });
    allTeachers = teachersResponse.data.items || teachersResponse.data.data || teachersResponse.data || [];
  } catch (error) {
    console.log('  ⚠️ Erro ao buscar professores:', error.response?.data?.message || error.message);
  }
  
  // Mapear professores por clube
  const teachersByClub = new Map();
  const unassignedTeachers = [];
  
  for (const teacher of allTeachers) {
    if (teacher.club?.id) {
      if (!teachersByClub.has(teacher.club.id)) {
        teachersByClub.set(teacher.club.id, []);
      }
      teachersByClub.get(teacher.club.id).push(teacher);
    } else {
      unassignedTeachers.push(teacher);
    }
  }
  
  // Verificar cada clube
  const clubsNeedingTeachers = [];
  for (const club of clubs) {
    const clubTeachers = teachersByClub.get(club.id) || [];
    const needed = minTeachersPerClub - clubTeachers.length;
    
    if (needed > 0) {
      clubsNeedingTeachers.push({
        club,
        current: clubTeachers.length,
        needed: needed
      });
      console.log(`  📍 Clube ${club.number}: ${clubTeachers.length} professores (precisa de mais ${needed})`);
    }
  }
  
  if (clubsNeedingTeachers.length === 0) {
    console.log('  ✅ Todos os clubes têm professores suficientes!\n');
    return;
  }
  
  // Calcular quantos professores precisamos criar
  const totalNeeded = clubsNeedingTeachers.reduce((sum, item) => sum + item.needed, 0);
  console.log(`\n  📊 Total de professores necessários: ${totalNeeded}`);
  console.log(`  📊 Professores disponíveis sem clube: ${unassignedTeachers.length}`);
  
  // Criar professores se necessário
  const teachersToCreate = Math.max(0, totalNeeded - unassignedTeachers.length);
  const newTeachers = [];
  
  if (teachersToCreate > 0) {
    console.log(`\n  👥 Criando ${teachersToCreate} novos professores...`);
    for (let i = 0; i < teachersToCreate; i++) {
      try {
        const user = {
          name: randomName(),
          email: randomEmail('teacher'),
          password: 'Senha123@',
          phone: randomPhone(),
          role: 'teacher',
          active: true,
          completed: true,
        };
        
        const createResponse = await authenticatedRequest('post', '/users', user);
        newTeachers.push(createResponse.data);
        process.stdout.write(`    ✅ Professor ${i + 1}/${teachersToCreate}: ${user.name}\n`);
      } catch (error) {
        console.error(`    ❌ Erro ao criar professor ${i + 1}:`, error.response?.data?.message || error.message);
      }
    }
    console.log(`  ✅ ${newTeachers.length} professores criados\n`);
  }
  
  // Buscar teacher profiles dos novos professores
  if (newTeachers.length > 0) {
    // Aguardar um pouco para garantir que os profiles foram criados
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Buscar todos os professores novamente
    const teachersResponse = await authenticatedRequest('get', '/teacher-profiles', { page: 1, limit: 2000 });
    const allTeachersUpdated = teachersResponse.data.items || teachersResponse.data.data || teachersResponse.data || [];
    
    // Adicionar novos professores não vinculados
    for (const newUser of newTeachers) {
      const teacherProfile = allTeachersUpdated.find(t => t.user?.id === newUser.id);
      if (teacherProfile && !teacherProfile.club?.id) {
        // Verificar se já não está na lista
        if (!unassignedTeachers.find(t => t.id === teacherProfile.id)) {
          unassignedTeachers.push(teacherProfile);
        }
      }
    }
  }
  
  // Vincular professores aos clubes
  console.log(`\n  🔗 Vinculando professores aos clubes...`);
  let totalAssigned = 0;
  
  for (const { club, needed } of clubsNeedingTeachers) {
    let assigned = 0;
    
    for (let i = 0; i < needed && unassignedTeachers.length > 0; i++) {
      const teacher = unassignedTeachers.shift();
      
      try {
        await authenticatedRequest('patch', `/teacher-profiles/${teacher.id}/assign-club`, {
          clubId: club.id,
        });
        assigned++;
        totalAssigned++;
        process.stdout.write(`    ✅ Clube ${club.number}: Professor ${teacher.user?.name || teacher.id} vinculado\n`);
      } catch (error) {
        // Se falhar, coloca de volta na lista
        unassignedTeachers.push(teacher);
        console.error(`    ❌ Erro ao vincular professor ao clube ${club.number}:`, error.response?.data?.message || error.message);
      }
    }
    
    if (assigned > 0) {
      console.log(`  📍 Clube ${club.number}: ${assigned} professores vinculados`);
    }
  }
  
  console.log(`\n✅ ${totalAssigned} professores vinculados aos clubes\n`);
}

async function ensureCoordinatorsForClubs(clubs, minClubsPerCoordinator = 3) {
  console.log(`\n👔 Verificando e garantindo coordenadores para clubes (mínimo ${minClubsPerCoordinator} clubes por coordenador)...`);
  
  // Buscar todos os coordenadores disponíveis
  let allCoordinators = [];
  try {
    const coordinatorsResponse = await authenticatedRequest('get', '/coordinator-profiles', { page: 1, limit: 1000 });
    allCoordinators = coordinatorsResponse.data.items || coordinatorsResponse.data.data || coordinatorsResponse.data || [];
  } catch (error) {
    console.log('  ⚠️ Erro ao buscar coordenadores:', error.response?.data?.message || error.message);
  }
  
  // Verificar quais clubes não têm coordenador
  const clubsWithoutCoordinator = [];
  const coordinatorsWithClubs = new Map(); // Map<coordinatorId, clubCount>
  
  for (const club of clubs) {
    const clubDetails = await authenticatedRequest('get', `/clubs/${club.id}`);
    const coordinator = clubDetails.data.coordinator;
    
    if (!coordinator) {
      clubsWithoutCoordinator.push(club);
    } else {
      const coordId = coordinator.id;
      coordinatorsWithClubs.set(coordId, (coordinatorsWithClubs.get(coordId) || 0) + 1);
    }
  }
  
  console.log(`  📊 Clubes sem coordenador: ${clubsWithoutCoordinator.length}`);
  console.log(`  📊 Coordenadores disponíveis: ${allCoordinators.length}`);
  
  if (clubsWithoutCoordinator.length === 0) {
    console.log('  ✅ Todos os clubes têm coordenadores!\n');
    return;
  }
  
  // Separar coordenadores por quantidade de clubes
  const coordinatorsByClubCount = new Map();
  for (const coord of allCoordinators) {
    const clubCount = coordinatorsWithClubs.get(coord.id) || 0;
    if (!coordinatorsByClubCount.has(clubCount)) {
      coordinatorsByClubCount.set(clubCount, []);
    }
    coordinatorsByClubCount.get(clubCount).push(coord);
  }
  
  // Priorizar coordenadores com menos clubes
  const sortedClubCounts = Array.from(coordinatorsByClubCount.keys()).sort((a, b) => a - b);
  const availableCoordinators = [];
  for (const count of sortedClubCounts) {
    availableCoordinators.push(...coordinatorsByClubCount.get(count));
  }
  
  // Calcular quantos coordenadores precisamos criar
  // Cada coordenador deve ter pelo menos minClubsPerCoordinator clubes
  const totalClubsNeedingCoordinator = clubsWithoutCoordinator.length;
  const existingCoordinatorsCanTake = availableCoordinators.length * minClubsPerCoordinator;
  const coordinatorsToCreate = Math.max(0, Math.ceil((totalClubsNeedingCoordinator - existingCoordinatorsCanTake) / minClubsPerCoordinator));
  
  const newCoordinators = [];
  
  if (coordinatorsToCreate > 0) {
    console.log(`\n  👔 Criando ${coordinatorsToCreate} novos coordenadores...`);
    for (let i = 0; i < coordinatorsToCreate; i++) {
      try {
        const user = {
          name: randomName(),
          email: randomEmail('coordinator'),
          password: 'Senha123@',
          phone: randomPhone(),
          role: 'coordinator',
          active: true,
          completed: true,
        };
        
        const createResponse = await authenticatedRequest('post', '/users', user);
        newCoordinators.push(createResponse.data);
        process.stdout.write(`    ✅ Coordenador ${i + 1}/${coordinatorsToCreate}: ${user.name}\n`);
      } catch (error) {
        console.error(`    ❌ Erro ao criar coordenador ${i + 1}:`, error.response?.data?.message || error.message);
      }
    }
    console.log(`  ✅ ${newCoordinators.length} coordenadores criados\n`);
  }
  
  // Buscar coordinator profiles dos novos coordenadores
  if (newCoordinators.length > 0) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const coordinatorsResponse = await authenticatedRequest('get', '/coordinator-profiles', { page: 1, limit: 2000 });
    const allCoordinatorsUpdated = coordinatorsResponse.data.items || coordinatorsResponse.data.data || coordinatorsResponse.data || [];
    
    for (const newUser of newCoordinators) {
      const coordinatorProfile = allCoordinatorsUpdated.find(c => c.user?.id === newUser.id);
      if (coordinatorProfile) {
        availableCoordinators.push(coordinatorProfile);
        coordinatorsWithClubs.set(coordinatorProfile.id, 0);
      }
    }
  }
  
  // Vincular coordenadores aos clubes (garantindo mínimo de clubes por coordenador)
  console.log(`\n  🔗 Vinculando coordenadores aos clubes...`);
  let totalAssigned = 0;
  let coordinatorIndex = 0;
  
  // Distribuir clubes entre coordenadores, garantindo mínimo por coordenador
  for (let i = 0; i < clubsWithoutCoordinator.length; i++) {
    const club = clubsWithoutCoordinator[i];
    
    // Selecionar coordenador (garantir que cada um tenha pelo menos minClubsPerCoordinator)
    let selectedCoordinator = null;
    
    // Primeiro, tentar encontrar um coordenador que ainda não atingiu o mínimo
    for (const coord of availableCoordinators) {
      const currentClubCount = coordinatorsWithClubs.get(coord.id) || 0;
      if (currentClubCount < minClubsPerCoordinator) {
        selectedCoordinator = coord;
        break;
      }
    }
    
    // Se todos já têm o mínimo, usar o próximo disponível
    if (!selectedCoordinator && coordinatorIndex < availableCoordinators.length) {
      selectedCoordinator = availableCoordinators[coordinatorIndex];
      coordinatorIndex = (coordinatorIndex + 1) % availableCoordinators.length;
    }
    
    // Se ainda não tem coordenador, criar um novo
    if (!selectedCoordinator) {
      try {
        const user = {
          name: randomName(),
          email: randomEmail('coordinator'),
          password: 'Senha123@',
          phone: randomPhone(),
          role: 'coordinator',
          active: true,
          completed: true,
        };
        
        const createResponse = await authenticatedRequest('post', '/users', user);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const coordinatorsResponse = await authenticatedRequest('get', '/coordinator-profiles', { page: 1, limit: 2000 });
        const allCoords = coordinatorsResponse.data.items || coordinatorsResponse.data.data || coordinatorsResponse.data || [];
        const newCoordProfile = allCoords.find(c => c.user?.id === createResponse.data.id);
        
        if (newCoordProfile) {
          selectedCoordinator = newCoordProfile;
          availableCoordinators.push(newCoordProfile);
          coordinatorsWithClubs.set(newCoordProfile.id, 0);
        }
      } catch (error) {
        console.error(`    ❌ Erro ao criar coordenador de emergência:`, error.response?.data?.message || error.message);
        continue;
      }
    }
    
    if (selectedCoordinator) {
      try {
        await authenticatedRequest('patch', `/coordinator-profiles/${selectedCoordinator.id}/assign-club`, {
          clubId: club.id,
        });
        
        const currentCount = coordinatorsWithClubs.get(selectedCoordinator.id) || 0;
        coordinatorsWithClubs.set(selectedCoordinator.id, currentCount + 1);
        totalAssigned++;
        
        if (totalAssigned % 10 === 0) {
          process.stdout.write(`    ✅ ${totalAssigned} clubes vinculados...\n`);
        }
      } catch (error) {
        console.error(`    ❌ Erro ao vincular coordenador ao clube ${club.number}:`, error.response?.data?.message || error.message);
      }
    }
  }
  
  console.log(`\n✅ ${totalAssigned} clubes vinculados a coordenadores\n`);
  
  // Verificar e redistribuir para garantir mínimo de clubes por coordenador
  console.log(`  🔄 Verificando se todos os coordenadores têm pelo menos ${minClubsPerCoordinator} clubes...`);
  
  // Buscar coordenadores com menos clubes
  const coordinatorsBelowMinimum = [];
  for (const coord of availableCoordinators) {
    const clubCount = coordinatorsWithClubs.get(coord.id) || 0;
    if (clubCount > 0 && clubCount < minClubsPerCoordinator) {
      coordinatorsBelowMinimum.push({ coord, count: clubCount, needed: minClubsPerCoordinator - clubCount });
    }
  }
  
  if (coordinatorsBelowMinimum.length > 0) {
    console.log(`  ⚠️ ${coordinatorsBelowMinimum.length} coordenadores têm menos de ${minClubsPerCoordinator} clubes`);
    
    // Buscar coordenadores com mais clubes para redistribuir
    const coordinatorsWithExcess = [];
    for (const coord of availableCoordinators) {
      const clubCount = coordinatorsWithClubs.get(coord.id) || 0;
      if (clubCount > minClubsPerCoordinator) {
        coordinatorsWithExcess.push({ coord, count: clubCount, excess: clubCount - minClubsPerCoordinator });
      }
    }
    
    // Redistribuir clubes dos coordenadores com excesso para os que precisam
    for (const { coord: needyCoord, needed } of coordinatorsBelowMinimum) {
      for (const { coord: excessCoord } of coordinatorsWithExcess) {
        if (needed <= 0) break;
        
        // Buscar clubes do coordenador com excesso
        try {
          const clubsResponse = await authenticatedRequest('get', '/clubs/all');
          const allClubs = clubsResponse.data;
          
          for (const club of allClubs) {
            if (needed <= 0) break;
            
            const clubDetails = await authenticatedRequest('get', `/clubs/${club.id}`);
            if (clubDetails.data.coordinator?.id === excessCoord.id) {
              try {
                await authenticatedRequest('patch', `/coordinator-profiles/${needyCoord.id}/assign-club`, {
                  clubId: club.id,
                });
                
                const excessCount = coordinatorsWithClubs.get(excessCoord.id) || 0;
                const needyCount = coordinatorsWithClubs.get(needyCoord.id) || 0;
                coordinatorsWithClubs.set(excessCoord.id, excessCount - 1);
                coordinatorsWithClubs.set(needyCoord.id, needyCount + 1);
                
                needed--;
                console.log(`    ✅ Clube ${club.number} redistribuído de ${excessCoord.user?.name} para ${needyCoord.user?.name}`);
              } catch (error) {
                // Ignorar erros de redistribuição
              }
            }
          }
        } catch (error) {
          // Ignorar erros
        }
      }
    }
    
    // Se ainda faltam clubes, criar novos coordenadores ou redistribuir de outros
    const stillNeeding = coordinatorsBelowMinimum.filter(c => {
      const currentCount = coordinatorsWithClubs.get(c.coord.id) || 0;
      return currentCount < minClubsPerCoordinator;
    });
    
    if (stillNeeding.length > 0) {
      console.log(`  ⚠️ ${stillNeeding.length} coordenadores ainda precisam de mais clubes`);
    } else {
      console.log(`  ✅ Todos os coordenadores têm pelo menos ${minClubsPerCoordinator} clubes!`);
    }
  } else {
    console.log(`  ✅ Todos os coordenadores têm pelo menos ${minClubsPerCoordinator} clubes!`);
  }
  
  console.log('');
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================
async function createDataInBulk() {
  console.log('🚀 ============================================');
  console.log('🚀 CRIAÇÃO DE DADOS EM MASSA');
  console.log('🚀 ============================================\n');
  
  // Verificar se a API está rodando
  try {
    await axios.get(`${API_BASE_URL}/`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ API não está rodando em localhost:3000. Por favor, inicie a API primeiro.');
      process.exit(1);
    }
  }
  
  // Login
  await login();
  
  const startTime = Date.now();
  
  // 1. Criar usuários
  const users = await createUsersInBulk(20);
  
  // 2. Buscar ou criar clubes
  let clubs = [];
  const existingClubsResponse = await authenticatedRequest('get', '/clubs/all');
  clubs = existingClubsResponse.data;
  
  if (clubs.length < 10) {
    const newClubs = await createClubsInBulk(10 - clubs.length);
    clubs = [...clubs, ...newClubs];
  }
  
  // 3. Garantir coordenadores para todos os clubes (mínimo 3 clubes por coordenador)
  await ensureCoordinatorsForClubs(clubs, 3);
  
  // 4. Garantir professores para todos os clubes (mínimo 10 por clube)
  await ensureTeachersForClubs(clubs, 10);
  
  // 5. Atualizar crianças existentes sem "No clubinho desde" (joinedAt)
  await updateChildrenWithoutJoinedAt();
  
  // 6. Criar crianças (sempre com joinedAt preenchido)
  const children = await createChildrenInBulk(clubs, 10);
  
  // 7. Criar accepted christs
  await createAcceptedChristsInBulk(children, 0.3);
  
  // 8. Criar pagelas
  await createPagelasInBulk(children, 48);
  
  // 9. Verificação final: garantir que todas as crianças têm joinedAt
  console.log('\n🔍 Verificação final: garantindo que todas as crianças têm joinedAt...');
  await updateChildrenWithoutJoinedAt();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Resumo final
  console.log('\n\n📊 ============================================');
  console.log('📊 RESUMO DA CRIAÇÃO EM MASSA');
  console.log('📊 ============================================');
  console.log(`👥 Usuários criados: ${users.length}`);
  console.log(`🏢 Clubes disponíveis: ${clubs.length}`);
  console.log(`👶 Crianças criadas: ${children.length}`);
  console.log(`📝 Pagelas criadas: ~${children.length * 48}`);
  console.log(`⏱️  Tempo total: ${duration}s`);
  console.log('\n🎉 Criação em massa concluída!\n');
}

// Executar
createDataInBulk().catch(error => {
  console.error('\n❌ Erro fatal:', error.message);
  console.error(error.stack);
  process.exit(1);
});
