
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const SUPERUSER_EMAIL = 'superuser@clubinhonib.com';
const SUPERUSER_PASSWORD = 'Abc@123';

let authToken = '';


async function login() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: SUPERUSER_EMAIL,
      password: SUPERUSER_PASSWORD,
    });
    return response.data.accessToken;
  } catch (error) {
    throw new Error(`Login falhou: ${error.response?.data?.message || error.message}`);
  }
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


async function testAcceptedChrist() {
  console.log('\n🧪 Testando AcceptedChristController...');
  
  try {
    
    const childrenResponse = await authenticatedRequest('get', '/children/simple');
    const children = childrenResponse.data;
    
    if (children.length === 0) {
      console.log('  ⚠️ Nenhuma criança encontrada. Pulando teste.');
      return;
    }
    
    const childId = children[0].id;
    
    
    const response = await axios.post(`${API_BASE_URL}/accepted-christs`, {
      childId: childId,
      decision: 'ACCEPTED',
      notes: 'Teste de criação',
    });
    
    if (response.status === 201 && response.data.id) {
      console.log('  ✅ AcceptedChrist criado com sucesso');
    } else {
      console.log('  ❌ Falha ao criar AcceptedChrist');
    }
  } catch (error) {
    console.log(`  ❌ Erro: ${error.response?.data?.message || error.message}`);
  }
}


async function testChildren() {
  console.log('\n🧪 Testando ChildrenController...');
  
  try {
    
    const clubsResponse = await authenticatedRequest('get', '/clubs/all');
    const clubs = clubsResponse.data;
    
    if (clubs.length === 0) {
      console.log('  ⚠️ Nenhum clube encontrado. Pulando teste.');
      return;
    }
    
    const clubId = clubs[0].id;
    
    
    const createResponse = await authenticatedRequest('post', '/children', {
      name: 'João Silva Teste',
      birthDate: '2015-05-15',
      guardianName: 'Maria Silva',
      gender: 'M',
      guardianPhone: '11999999999',
      isActive: true,
      clubId: clubId,
    });
    
    if (createResponse.status === 201 && createResponse.data.id) {
      console.log('  ✅ Criança criada com sucesso');
      const childId = createResponse.data.id;
      
      
      const listResponse = await authenticatedRequest('get', '/children', { page: 1, limit: 10 });
      if (listResponse.status === 200 && Array.isArray(listResponse.data.data)) {
        console.log('  ✅ Listagem de crianças funcionando');
      }
      
      
      await authenticatedRequest('delete', `/children/${childId}`);
    } else {
      console.log('  ❌ Falha ao criar criança');
    }
  } catch (error) {
    console.log(`  ❌ Erro: ${error.response?.data?.message || error.message}`);
  }
}


async function testClubs() {
  console.log('\n🧪 Testando ClubsController...');
  
  try {
    
    const listResponse = await authenticatedRequest('get', '/clubs', { page: 1, limit: 10 });
    if (listResponse.status === 200 && listResponse.data.data) {
      console.log('  ✅ Listagem de clubes funcionando');
    }
    
    
    const createResponse = await authenticatedRequest('post', '/clubs', {
      number: 999,
      weekday: 'monday',
      time: '14:00',
      isActive: true,
      address: {
        street: 'Rua Teste',
        number: '123',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01234567',
      },
    });
    
    if (createResponse.status === 201 && createResponse.data.id) {
      console.log('  ✅ Clube criado com sucesso');
      const clubId = createResponse.data.id;
      
      
      await authenticatedRequest('delete', `/clubs/${clubId}`);
    } else {
      console.log('  ❌ Falha ao criar clube');
    }
  } catch (error) {
    console.log(`  ❌ Erro: ${error.response?.data?.message || error.message}`);
  }
}


async function testUsers() {
  console.log('\n🧪 Testando UserController...');
  
  try {
    
    const createResponse = await authenticatedRequest('post', '/users', {
      name: 'Usuário Teste',
      email: `teste.${Date.now()}@example.com`,
      password: 'Senha123@',
      phone: '11999999999',
      role: 'teacher',
      active: true,
    });
    
    if (createResponse.status === 201 && createResponse.data.id) {
      console.log('  ✅ Usuário criado com sucesso');
      const userId = createResponse.data.id;
      
      
      const listResponse = await authenticatedRequest('get', '/users', { page: 1, limit: 10 });
      if (listResponse.status === 200) {
        console.log('  ✅ Listagem de usuários funcionando');
      }
      
      
      await authenticatedRequest('delete', `/users/${userId}`);
    } else {
      console.log('  ❌ Falha ao criar usuário');
    }
  } catch (error) {
    console.log(`  ❌ Erro: ${error.response?.data?.message || error.message}`);
  }
}


async function testPagelas() {
  console.log('\n🧪 Testando PagelasController...');
  
  try {
    
    const childrenResponse = await authenticatedRequest('get', '/children/simple');
    const children = childrenResponse.data;
    
    if (children.length === 0) {
      console.log('  ⚠️ Nenhuma criança encontrada. Pulando teste.');
      return;
    }
    
    const childId = children[0].id;
    
    
    const createResponse = await authenticatedRequest('post', '/pagelas', {
      childId: childId,
      referenceDate: '2025-01-15',
      week: 1,
      year: 2025,
      present: true,
      didMeditation: true,
      recitedVerse: true,
    });
    
    if (createResponse.status === 201 && createResponse.data.id) {
      console.log('  ✅ Pagela criada com sucesso');
      const pagelaId = createResponse.data.id;
      
      
      const listResponse = await authenticatedRequest('get', '/pagelas');
      if (listResponse.status === 200 && Array.isArray(listResponse.data)) {
        console.log('  ✅ Listagem de pagelas funcionando');
      }
      
      
      await authenticatedRequest('delete', `/pagelas/${pagelaId}`);
    } else {
      console.log('  ❌ Falha ao criar pagela');
    }
  } catch (error) {
    console.log(`  ❌ Erro: ${error.response?.data?.message || error.message}`);
  }
}


async function runTests() {
  console.log('🚀 Iniciando testes E2E contra API real...\n');
  
  
  try {
    await axios.get(`${API_BASE_URL}/`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ API não está rodando em localhost:3000. Por favor, inicie a API primeiro.');
      process.exit(1);
    }
  }
  
  
  try {
    authToken = await login();
    console.log('✅ Login realizado com sucesso\n');
  } catch (error) {
    console.error(`❌ Erro no login: ${error.message}`);
    process.exit(1);
  }
  
  
  await testAcceptedChrist();
  await testChildren();
  await testClubs();
  await testUsers();
  await testPagelas();
  
  console.log('\n✅ Todos os testes concluídos!');
}


runTests().catch(error => {
  console.error('\n❌ Erro fatal:', error.message);
  process.exit(1);
});

