

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const SUPERUSER_EMAIL = 'superuser@clubinhonib.com';
const SUPERUSER_PASSWORD = 'Abc@123';

let authToken = '';


function randomJoinedAt() {
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

async function login() {
  console.log('\n🔐 Logging in...');
  const response = await axios.post(`${API_BASE_URL}/auth/login`, {
    email: SUPERUSER_EMAIL,
    password: SUPERUSER_PASSWORD,
  });
  
  authToken = response.data.accessToken;
  console.log('✅ Login successful\n');
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

async function updateChildrenWithoutJoinedAt() {
  console.log('📅 Checking and updating children without "No clubinho desde" (joinedAt)...\n');
  
  let page = 1;
  const limit = 100;
  let totalUpdated = 0;
  let totalChecked = 0;
  let totalPages = 1;
  
  
  try {
    const firstResponse = await authenticatedRequest('get', '/children', { page: 1, limit });
    totalPages = firstResponse.data.meta?.totalPages || 1;
    console.log(`📊 Total pages: ${totalPages} (${firstResponse.data.meta?.totalItems || 0} children total)\n`);
  } catch (error) {
    console.error('❌ Error fetching information:', error.response?.data?.message || error.message);
    return;
  }
  
  
  while (page <= totalPages) {
    try {
      console.log(`📄 Processing page ${page}/${totalPages}...`);
      const response = await authenticatedRequest('get', '/children', { page, limit });
      const children = response.data.data || [];
      
      if (children.length === 0) {
        console.log('  ⚠️ No children found on this page\n');
        break;
      }
      
      let pageUpdated = 0;
      
      for (const child of children) {
        totalChecked++;
        
        
        if (!child.joinedAt || child.joinedAt === null || child.joinedAt === 'null') {
          try {
            const joinedAt = randomJoinedAt();
            await authenticatedRequest('put', `/children/${child.id}`, {
              joinedAt: joinedAt,
            });
            totalUpdated++;
            pageUpdated++;
            
            if (totalUpdated % 50 === 0) {
              console.log(`  ✅ ${totalUpdated} children updated so far...`);
            }
          } catch (error) {
            console.error(`  ❌ Error updating child ${child.id} (${child.name}):`, error.response?.data?.message || error.message);
          }
        }
      }
      
      if (pageUpdated > 0) {
        console.log(`  ✅ Page ${page}: ${pageUpdated} children updated (${children.length} checked)\n`);
      } else {
        console.log(`  ✅ Page ${page}: All ${children.length} children already have joinedAt\n`);
      }
      
      page++;
      
      
      if (page <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`  ❌ Error processing page ${page}:`, error.response?.data?.message || error.message);
      page++;
    }
  }
  
  console.log('\n📊 ============================================');
  console.log('📊 SUMMARY');
  console.log('📊 ============================================');
  console.log(`✅ Children checked: ${totalChecked}`);
  console.log(`✅ Children updated: ${totalUpdated}`);
  console.log(`✅ Children that already had joinedAt: ${totalChecked - totalUpdated}`);
  console.log('\n🎉 Process completed!\n');
  
  return totalUpdated;
}

async function main() {
  console.log('🚀 ============================================');
  console.log('🚀 UPDATING "NO CLUBINHO DESDE"');
  console.log('🚀 ============================================\n');
  
  
  try {
    await axios.get(`${API_BASE_URL}/`);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ API is not running on localhost:3000. Please start the API first.');
      process.exit(1);
    }
  }
  
  
  await login();
  
  
  await updateChildrenWithoutJoinedAt();
}


main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});

