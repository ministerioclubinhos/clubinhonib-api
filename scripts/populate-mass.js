const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const SUPERUSER_EMAIL = 'superuser@clubinhonib.com';
const SUPERUSER_PASSWORD = 'Abc@123';

// Função para fazer login
async function login() {
  console.log('🔐 Fazendo login...');
  const response = await axios.post(`${API_BASE_URL}/auth/login`, {
    email: SUPERUSER_EMAIL,
    password: SUPERUSER_PASSWORD,
  });
  
  const token = response.data.accessToken;
  console.log('✅ Login realizado com sucesso');
  return token;
}

// Função para buscar todos os clubes
async function getAllClubs(token) {
  console.log('📋 Buscando todos os clubes...');
  const response = await axios.get(`${API_BASE_URL}/clubs/all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  console.log(`✅ Encontrados ${response.data.length} clubes`);
  return response.data;
}

// Função para buscar detalhes de um clube (com professores)
async function getClubDetails(token, clubId) {
  const response = await axios.get(`${API_BASE_URL}/clubs/${clubId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

// Função para criar um usuário professor
async function createTeacherUser(token, clubNumber, index) {
  const teacherNames = [
    'Professor João', 'Professora Maria', 'Professor Pedro', 'Professora Ana',
    'Professor Carlos', 'Professora Julia', 'Professor Lucas', 'Professora Sofia'
  ];
  
  const name = teacherNames[index % teacherNames.length];
  const email = `professor.clube${clubNumber}.${index + 1}@clubinhonib.com`;
  
  const response = await axios.post(
    `${API_BASE_URL}/users`,
    {
      name: `${name} - Clube ${clubNumber}`,
      email: email,
      password: 'Senha123@',
      phone: `11${String(800000000 + clubNumber * 10 + index).padStart(9, '0')}`,
      role: 'teacher',
      active: true,
      completed: true,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}

// Função para buscar teacher profile de um usuário
async function findTeacherProfileByUserId(token, userId) {
  try {
    // Buscar todos os teachers e filtrar pelo userId
    const response = await axios.get(`${API_BASE_URL}/teacher-profiles`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, limit: 1000 },
    });
    
    // O response pode ter uma estrutura paginada
    const teachers = response.data.items || response.data || [];
    const teacher = teachers.find(t => t.user?.id === userId);
    return teacher;
  } catch (error) {
    console.error('Erro ao buscar teacher profile:', error.response?.data || error.message);
    return null;
  }
}

// Função para vincular teacher ao clube
async function assignTeacherToClub(token, teacherId, clubId) {
  await axios.patch(
    `${API_BASE_URL}/teacher-profiles/${teacherId}/assign-club`,
    { clubId: clubId },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// Função para buscar período letivo de 2025
async function getPeriod2025(token) {
  console.log('📅 Buscando período letivo de 2025...');
  try {
    const response = await axios.get(`${API_BASE_URL}/club-control/periods/2025`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`✅ Período letivo 2025 encontrado: ${response.data.startDate} a ${response.data.endDate}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️ Período letivo de 2025 não encontrado. Criando...');
      // Criar período letivo de 2025 (assumindo início em fevereiro e fim em dezembro)
      const createResponse = await axios.post(
        `${API_BASE_URL}/club-control/periods`,
        {
          year: 2025,
          startDate: '2025-02-03', // Primeira segunda-feira de fevereiro
          endDate: '2025-12-15',
          description: 'Ano Letivo 2025',
          isActive: true,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log(`✅ Período letivo 2025 criado: ${createResponse.data.startDate} a ${createResponse.data.endDate}`);
      return createResponse.data;
    }
    throw error;
  }
}

// Função para calcular a data de uma semana específica do ano letivo
function getDateForAcademicWeek(period, week, weekday = 'monday') {
  const startDate = new Date(period.startDate + 'T00:00:00');
  
  // Obter o início da semana (segunda-feira) da data de início
  const getWeekStartDate = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para segunda-feira
    return new Date(d.setDate(diff));
  };
  
  const periodWeekStart = getWeekStartDate(startDate);
  
  // Calcular o início da semana N (semana 1 = periodWeekStart)
  const academicWeekStart = new Date(periodWeekStart);
  academicWeekStart.setDate(periodWeekStart.getDate() + (week - 1) * 7);
  
  // Ajustar para o dia da semana do clube
  const weekdayMap = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  
  const targetWeekday = weekdayMap[weekday] || 1;
  const currentWeekday = academicWeekStart.getDay() || 7; // 0 = domingo -> 7
  const diff = targetWeekday - currentWeekday;
  academicWeekStart.setDate(academicWeekStart.getDate() + diff);
  
  return academicWeekStart.toISOString().split('T')[0];
}

// Função para criar uma criança
async function createChild(token, clubId, index) {
  const names = [
    'Ana Silva', 'Bruno Costa', 'Carlos Santos', 'Diana Oliveira', 'Eduardo Lima',
    'Fernanda Souza', 'Gabriel Alves', 'Helena Pereira', 'Igor Rodrigues', 'Julia Ferreira'
  ];
  
  const genders = ['M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F'];
  
  const name = names[index % names.length];
  const gender = genders[index % genders.length];
  const birthYear = 2015 + (index % 5); // Idades variadas entre 8-12 anos
  
  const response = await axios.post(
    `${API_BASE_URL}/children`,
    {
      name: `${name} ${index + 1}`,
      birthDate: `${birthYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 25) + 1).padStart(2, '0')}`,
      guardianName: `Responsável ${name}`,
      gender: gender,
      guardianPhone: `11${String(900000000 + index).padStart(9, '0')}`,
      isActive: true,
      clubId: clubId,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  return response.data;
}

// Função para criar uma pagela
async function createPagela(token, childId, referenceDate, week, year) {
  // Gerar valores aleatórios para present, didMeditation, recitedVerse
  const present = Math.random() > 0.2; // 80% de presença
  const didMeditation = present && Math.random() > 0.3; // 70% dos presentes fazem meditação
  const recitedVerse = present && Math.random() > 0.4; // 60% dos presentes recitam versículo
  
  await axios.post(
    `${API_BASE_URL}/pagelas`,
    {
      childId: childId,
      referenceDate: referenceDate,
      week: week,
      year: year,
      present: present,
      didMeditation: didMeditation,
      recitedVerse: recitedVerse,
      notes: present ? `Semana ${week} - ${present ? 'Presente' : 'Ausente'}` : null,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// Função principal
async function populate() {
  try {
    console.log('🚀 Iniciando população em massa...\n');
    
    // 1. Login
    const token = await login();
    
    // 2. Buscar período letivo de 2025
    const period = await getPeriod2025(token);
    if (!period) {
      throw new Error('Não foi possível obter ou criar o período letivo de 2025');
    }
    
    // 3. Buscar todos os clubes
    const clubs = await getAllClubs(token);
    
    if (clubs.length === 0) {
      console.log('⚠️ Nenhum clube encontrado. Criando um clube de exemplo...');
      // Criar um clube de exemplo
      const clubResponse = await axios.post(
        `${API_BASE_URL}/clubs`,
        {
          number: 1,
          weekday: 'monday',
          time: '14:00',
          isActive: true,
          address: {
            street: 'Rua Exemplo',
            number: '123',
            district: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            postalCode: '01234567',
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      clubs.push(clubResponse.data);
    }
    
    console.log(`\n📊 Processando ${clubs.length} clubes...\n`);
    
    let totalChildren = 0;
    let totalPagelas = 0;
    
    // 4. Para cada clube, verificar professores e criar se necessário
    for (const club of clubs) {
      console.log(`\n🏢 Processando Clube ${club.number} (${club.weekday})...`);
      
      // Verificar se o clube tem professores
      const clubDetails = await getClubDetails(token, club.id);
      const hasTeachers = clubDetails.teachers && clubDetails.teachers.length > 0;
      
      if (!hasTeachers) {
        console.log(`  👨‍🏫 Clube não tem professores. Criando 1 professor...`);
        try {
          // Criar um usuário professor
          const teacherUser = await createTeacherUser(token, club.number, 0);
          console.log(`  ✅ Usuário professor criado: ${teacherUser.name}`);
          
          // Aguardar um pouco para garantir que o teacher profile foi criado
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Buscar o teacher profile
          const teacherProfile = await findTeacherProfileByUserId(token, teacherUser.id);
          
          if (teacherProfile) {
            // Vincular ao clube
            await assignTeacherToClub(token, teacherProfile.id, club.id);
            console.log(`  ✅ Professor vinculado ao clube`);
          } else {
            console.log(`  ⚠️ Teacher profile não encontrado para o usuário ${teacherUser.id}`);
          }
        } catch (error) {
          console.error(`  ❌ Erro ao criar/vincular professor:`, error.response?.data?.message || error.message);
        }
      } else {
        console.log(`  ✅ Clube já tem ${clubDetails.teachers.length} professor(es)`);
      }
      
      const children = [];
      
      // Criar 10 crianças
      for (let i = 0; i < 10; i++) {
        try {
          const child = await createChild(token, club.id, totalChildren);
          children.push(child);
          totalChildren++;
          process.stdout.write(`  ✅ Criança ${i + 1}/10: ${child.name}\n`);
        } catch (error) {
          console.error(`  ❌ Erro ao criar criança ${i + 1}:`, error.response?.data?.message || error.message);
        }
      }
      
      // 5. Para cada criança, criar pagelas para todas as 48 semanas
      console.log(`  📝 Criando pagelas para ${children.length} crianças...`);
      
      for (const child of children) {
        for (let week = 1; week <= 48; week++) {
          try {
            const referenceDate = getDateForAcademicWeek(period, week, club.weekday);
            await createPagela(token, child.id, referenceDate, week, 2025);
            totalPagelas++;
            
            if (week % 10 === 0) {
              process.stdout.write(`    Semana ${week}... `);
            }
          } catch (error) {
            // Ignorar erros de pagela duplicada ou fora do período
            if (error.response?.status !== 400 && error.response?.status !== 409) {
              console.error(`\n    ❌ Erro ao criar pagela semana ${week} para ${child.name}:`, error.response?.data?.message || error.message);
            }
          }
        }
        console.log(`\n  ✅ ${child.name}: 48 pagelas criadas`);
      }
      
      console.log(`✅ Clube ${club.number} concluído: ${children.length} crianças, ${children.length * 48} pagelas`);
    }
    
    console.log(`\n\n🎉 População concluída!`);
    console.log(`📊 Resumo:`);
    console.log(`   - Clubes processados: ${clubs.length}`);
    console.log(`   - Crianças criadas: ${totalChildren}`);
    console.log(`   - Pagelas criadas: ${totalPagelas}`);
    console.log(`   - Período letivo: ${period.startDate} a ${period.endDate}`);
    
  } catch (error) {
    console.error('\n❌ Erro durante a população:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Executar
populate();

