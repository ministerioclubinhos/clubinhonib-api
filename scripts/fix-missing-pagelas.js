

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const SUPERUSER_EMAIL = 'superuser@clubinhonib.com';
const SUPERUSER_PASSWORD = 'Abc@123';

let authToken = '';

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

async function getAllClubs() {
  console.log('🏢 Listing all clubs...\n');
  
  let page = 1;
  const limit = 100;
  const allClubs = [];
  let totalPages = 1;
  
  
  try {
    const firstResponse = await authenticatedRequest('get', '/clubs', { 
      page: 1, 
      limit,
      sort: 'updatedAt',
      order: 'DESC'
    });
    totalPages = firstResponse.data.pageCount || 1;
    console.log(`📊 Total club pages: ${totalPages}`);
  } catch (error) {
    console.error('❌ Error fetching club information:', error.response?.data?.message || error.message);
    return [];
  }
  
  
  while (page <= totalPages) {
    try {
      const response = await authenticatedRequest('get', '/clubs', { 
        page, 
        limit,
        sort: 'updatedAt',
        order: 'DESC'
      });
      const clubs = response.data.data || [];
      
      if (clubs.length === 0) break;
      
      allClubs.push(...clubs);
      console.log(`  📄 Page ${page}/${totalPages}: ${clubs.length} clubs found`);
      
      page++;
      
      
      if (page <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error(`  ❌ Error fetching page ${page} of clubs:`, error.response?.data?.message || error.message);
      page++;
    }
  }
  
  console.log(`✅ Total clubs found: ${allClubs.length}\n`);
  return allClubs;
}

async function getAllChildrenFromClub(clubId, clubNumber) {
  let page = 1;
  const limit = 100;
  const allChildren = [];
  let totalPages = 1;
  
  
  try {
    const firstResponse = await authenticatedRequest('get', '/children', { 
      page: 1, 
      limit,
      clubNumber: clubNumber,
      orderBy: 'updatedAt',
      order: 'DESC'
    });
    totalPages = firstResponse.data.meta?.totalPages || 1;
  } catch (error) {
    console.error(`  ❌ Error fetching children information for club ${clubNumber}:`, error.response?.data?.message || error.message);
    return [];
  }
  
  
  while (page <= totalPages) {
    try {
      const response = await authenticatedRequest('get', '/children', { 
        page, 
        limit,
        clubNumber: clubNumber,
        orderBy: 'updatedAt',
        order: 'DESC'
      });
      const children = response.data.data || [];
      
      if (children.length === 0) break;
      
      allChildren.push(...children);
      
      page++;
      
      
      if (page <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    } catch (error) {
      console.error(`  ❌ Error fetching page ${page} of children:`, error.response?.data?.message || error.message);
      page++;
    }
  }
  
  return allChildren;
}

async function getChildPagelas(childId, year) {
  try {
    const response = await authenticatedRequest('get', '/pagelas/paginated', {
      childId: childId,
      year: year,
      page: 1,
      limit: 100,
    });
    
    return response.data.items || [];
  } catch (error) {
    return [];
  }
}

async function createMissingPagelasForChild(child, period, weekday, totalWeeks) {
  
  let allExistingPagelas = [];
  let page = 1;
  const limit = 100;
  
  while (true) {
    try {
      const response = await authenticatedRequest('get', '/pagelas/paginated', {
        childId: child.id,
        year: period.year,
        page: page,
        limit: limit,
      });
      
      const items = response.data.items || [];
      if (items.length === 0) break;
      
      allExistingPagelas.push(...items);
      
      
      const total = response.data.total || 0;
      if (allExistingPagelas.length >= total) break;
      
      page++;
    } catch (error) {
      break;
    }
  }
  
  const existingWeeks = new Set(allExistingPagelas.map(p => p.week));
  
  
  let startWeek = 1;
  if (child.joinedAt) {
    const joinedDate = new Date(child.joinedAt + 'T00:00:00');
    const periodStart = new Date(period.startDate + 'T00:00:00');
    
    
    const daysDiff = Math.floor((joinedDate - periodStart) / (1000 * 60 * 60 * 24));
    startWeek = Math.max(1, Math.floor(daysDiff / 7) + 1);
  }
  
  let created = 0;
  let errors = 0;
  const weeksToCreate = [];
  
  
  for (let week = startWeek; week <= totalWeeks; week++) {
    if (!existingWeeks.has(week)) {
      weeksToCreate.push(week);
    }
  }
  
  if (weeksToCreate.length === 0) {
    return { created: 0, errors: 0, existing: allExistingPagelas.length };
  }
  
  
  for (const week of weeksToCreate) {
    try {
      const referenceDate = getDateForWeek(period, week, weekday);
      
      const present = Math.random() > 0.2; 
      const didMeditation = present && Math.random() > 0.3;
      const recitedVerse = present && Math.random() > 0.4;
      
      await authenticatedRequest('post', '/pagelas', {
        childId: child.id,
        referenceDate: referenceDate,
        week: week,
        year: period.year,
        present: present,
        didMeditation: didMeditation,
        recitedVerse: recitedVerse,
        notes: present ? `Week ${week} - ${present ? 'Present' : 'Absent'}` : null,
      });
      
      created++;
      
      
      await new Promise(resolve => setTimeout(resolve, 20));
    } catch (error) {
      
      if (error.response?.status === 400 || error.response?.status === 409 || error.response?.status === 404) {
        
      } else {
        errors++;
        console.error(`      ⚠️ Error creating pagela week ${week}:`, error.response?.data?.message || error.message);
      }
    }
  }
  
  
  if (created > 0) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    
    const verifyPagelas = await getChildPagelas(child.id, period.year);
    const verifyWeeks = new Set(verifyPagelas.map(p => p.week));
    const stillMissing = [];
    
    for (let week = startWeek; week <= totalWeeks; week++) {
      if (!verifyWeeks.has(week)) {
        stillMissing.push(week);
      }
    }
    
    if (stillMissing.length > 0) {
      console.error(`      ⚠️ Still missing ${stillMissing.length} weeks after creation:`, stillMissing.slice(0, 5).join(', '));
    }
  }
  
  return { created, errors, existing: allExistingPagelas.length };
}

async function main() {
  console.log('🚀 ============================================');
  console.log('🚀 CREATING MISSING PAGELAS');
  console.log('🚀 Processing all clubs and children');
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
  
  
  let period = null;
  let totalWeeks = 48;
  
  try {
    const currentWeekResponse = await authenticatedRequest('get', '/club-control/current-week');
    period = {
      year: currentWeekResponse.data.year,
      startDate: currentWeekResponse.data.periodStartDate,
      endDate: currentWeekResponse.data.periodEndDate,
    };
    totalWeeks = currentWeekResponse.data.week || 48;
    console.log(`📅 Academic period ${period.year}: ${period.startDate} to ${period.endDate}`);
    console.log(`📅 Total weeks: ${totalWeeks}\n`);
  } catch (error) {
    console.log('  ⚠️ Error fetching academic period. Trying to fetch directly...');
    try {
      const periodResponse = await authenticatedRequest('get', '/club-control/periods/2025');
      period = periodResponse.data;
      console.log(`📅 Academic period 2025: ${period.startDate} to ${period.endDate}\n`);
    } catch (err) {
      console.error('  ❌ Error fetching academic period:', err.response?.data?.message || err.message);
      return;
    }
  }
  
  
  const clubs = await getAllClubs();
  
  if (clubs.length === 0) {
    console.log('⚠️ No clubs found\n');
    return;
  }
  
  
  let totalChildrenProcessed = 0;
  let totalChildrenWithMissingPagelas = 0;
  let totalPagelasCreated = 0;
  let totalErrors = 0;
  
  
  for (let i = 0; i < clubs.length; i++) {
    const club = clubs[i];
    console.log(`\n🏢 Club ${club.number} (${i + 1}/${clubs.length}):`);
    console.log(`  📍 ${club.address?.city || 'N/A'}, ${club.address?.state || 'N/A'}`);
    console.log(`  📅 ${club.weekday} ${club.time || ''}`);
    
    
    const children = await getAllChildrenFromClub(club.id, club.number);
    
    if (children.length === 0) {
      console.log(`  ⚠️ No children found in this club\n`);
      continue;
    }
    
    console.log(`  👶 ${children.length} children found`);
    
    let clubChildrenWithMissing = 0;
    let clubPagelasCreated = 0;
    
    
    for (let j = 0; j < children.length; j++) {
      const child = children[j];
      totalChildrenProcessed++;
      
      try {
        
        let startWeek = 1;
        if (child.joinedAt) {
          const joinedDate = new Date(child.joinedAt + 'T00:00:00');
          const periodStart = new Date(period.startDate + 'T00:00:00');
          const daysDiff = Math.floor((joinedDate - periodStart) / (1000 * 60 * 60 * 24));
          startWeek = Math.max(1, Math.floor(daysDiff / 7) + 1);
        }
        const expectedWeeks = totalWeeks - (startWeek - 1);
        
        const result = await createMissingPagelasForChild(
          child, 
          period, 
          club.weekday, 
          totalWeeks
        );
        
        if (result.created > 0) {
          clubChildrenWithMissing++;
          totalChildrenWithMissingPagelas++;
          clubPagelasCreated += result.created;
          totalPagelasCreated += result.created;
          
          console.log(`    ✅ ${child.name}: ${result.created} pagelas created (had ${result.existing}, expected: ${expectedWeeks})`);
        } else {
          
          if (result.existing < expectedWeeks) {
            console.log(`    ⚠️ ${child.name}: Has ${result.existing} pagelas, expected ${expectedWeeks} (joinedAt: ${child.joinedAt || 'N/A'}, startWeek: ${startWeek})`);
            
            const retryResult = await createMissingPagelasForChild(child, period, club.weekday, totalWeeks);
            if (retryResult.created > 0) {
              clubChildrenWithMissing++;
              clubPagelasCreated += retryResult.created;
              totalPagelasCreated += retryResult.created;
              console.log(`    ✅ ${child.name} (retry): ${retryResult.created} pagelas created`);
            }
          }
        }
        
        
        if (j < children.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      } catch (error) {
        totalErrors++;
        console.error(`    ❌ Error processing ${child.name}:`, error.response?.data?.message || error.message);
      }
    }
    
    if (clubChildrenWithMissing > 0) {
      console.log(`  📊 Club ${club.number}: ${clubChildrenWithMissing} children updated, ${clubPagelasCreated} pagelas created`);
    } else {
      console.log(`  ✅ Club ${club.number}: All ${children.length} children have all pagelas`);
    }
    
    
    if (i < clubs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  
  console.log('\n\n📊 ============================================');
  console.log('📊 FINAL SUMMARY');
  console.log('📊 ============================================');
  console.log(`🏢 Clubs processed: ${clubs.length}`);
  console.log(`👶 Children processed: ${totalChildrenProcessed}`);
  console.log(`⚠️ Children with missing pagelas: ${totalChildrenWithMissingPagelas}`);
  console.log(`✅ Pagelas created: ${totalPagelasCreated}`);
  if (totalErrors > 0) {
    console.log(`❌ Errors: ${totalErrors}`);
  }
  console.log('\n🎉 Process completed!\n');
}


main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
