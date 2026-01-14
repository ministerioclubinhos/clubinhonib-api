
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
    throw new Error(`Login failed: ${error.response?.data?.message || error.message}`);
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
  console.log('\n🧪 Testing AcceptedChristController...');
  
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
      console.log('  ✅ AcceptedChrist created successfully');
    } else {
      console.log('  ❌ Failed to create AcceptedChrist');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.response?.data?.message || error.message}`);
  }
}


async function testChildren() {
  console.log('\n🧪 Testing ChildrenController...');
  
  try {
    
    const clubsResponse = await authenticatedRequest('get', '/clubs/all');
    const clubs = clubsResponse.data;
    
    if (clubs.length === 0) {
      console.log('  ⚠️ No clubs found. Skipping test.');
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
      console.log('  ✅ Child created successfully');
      const childId = createResponse.data.id;
      
      
      const listResponse = await authenticatedRequest('get', '/children', { page: 1, limit: 10 });
      if (listResponse.status === 200 && Array.isArray(listResponse.data.data)) {
        console.log('  ✅ Children listing working');
      }
      
      
      await authenticatedRequest('delete', `/children/${childId}`);
    } else {
      console.log('  ❌ Failed to create child');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.response?.data?.message || error.message}`);
  }
}


async function testClubs() {
  console.log('\n🧪 Testing ClubsController...');
  
  try {
    
    const listResponse = await authenticatedRequest('get', '/clubs', { page: 1, limit: 10 });
    if (listResponse.status === 200 && listResponse.data.data) {
      console.log('  ✅ Clubs listing working');
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
      console.log('  ✅ Club created successfully');
      const clubId = createResponse.data.id;
      
      
      await authenticatedRequest('delete', `/clubs/${clubId}`);
    } else {
      console.log('  ❌ Failed to create club');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.response?.data?.message || error.message}`);
  }
}


async function testUsers() {
  console.log('\n🧪 Testing UserController...');
  
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
      console.log('  ✅ User created successfully');
      const userId = createResponse.data.id;
      
      
      const listResponse = await authenticatedRequest('get', '/users', { page: 1, limit: 10 });
      if (listResponse.status === 200) {
        console.log('  ✅ Users listing working');
      }
      
      
      await authenticatedRequest('delete', `/users/${userId}`);
    } else {
      console.log('  ❌ Failed to create user');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.response?.data?.message || error.message}`);
  }
}


async function testPagelas() {
  console.log('\n🧪 Testing PagelasController...');
  
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
      console.log('  ✅ Pagela created successfully');
      const pagelaId = createResponse.data.id;
      
      
      const listResponse = await authenticatedRequest('get', '/pagelas');
      if (listResponse.status === 200 && Array.isArray(listResponse.data)) {
        console.log('  ✅ Pagelas listing working');
      }
      
      
      await authenticatedRequest('delete', `/pagelas/${pagelaId}`);
    } else {
      console.log('  ❌ Failed to create pagela');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.response?.data?.message || error.message}`);
  }
}


async function runTests() {
  console.log('🚀 Starting E2E tests against real API...\n');
  
  
  try {
    await axios.get(`${API_BASE_URL}/`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ API is not running on localhost:3000. Please start the API first.');
      process.exit(1);
    }
  }
  
  
  try {
    authToken = await login();
    console.log('✅ Login successful\n');
  } catch (error) {
    console.error(`❌ Login error: ${error.message}`);
    process.exit(1);
  }
  
  
  await testAcceptedChrist();
  await testChildren();
  await testClubs();
  await testUsers();
  await testPagelas();
  
  console.log('\n✅ All tests completed!');
}


runTests().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});

