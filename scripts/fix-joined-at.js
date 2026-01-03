/**
 * Script para atualizar todas as crianças sem "No clubinho desde" (joinedAt)
 * 
 * Para executar:
 * node scripts/fix-joined-at.js
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const SUPERUSER_EMAIL = 'superuser@clubinhonib.com';
const SUPERUSER_PASSWORD = 'Abc@123';

let authToken = '';

// Gerar data aleatória de entrada no clubinho (entre 2020-01-01 e hoje)
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

async function updateChildrenWithoutJoinedAt() {
  console.log('📅 Verificando e atualizando crianças sem "No clubinho desde" (joinedAt)...\n');
  
  let page = 1;
  const limit = 100;
  let totalUpdated = 0;
  let totalChecked = 0;
  let totalPages = 1;
  
  // Primeiro, buscar para saber quantas páginas temos
  try {
    const firstResponse = await authenticatedRequest('get', '/children', { page: 1, limit });
    totalPages = firstResponse.data.meta?.totalPages || 1;
    console.log(`📊 Total de páginas: ${totalPages} (${firstResponse.data.meta?.totalItems || 0} crianças no total)\n`);
  } catch (error) {
    console.error('❌ Erro ao buscar informações:', error.response?.data?.message || error.message);
    return;
  }
  
  // Processar todas as páginas
  while (page <= totalPages) {
    try {
      console.log(`📄 Processando página ${page}/${totalPages}...`);
      const response = await authenticatedRequest('get', '/children', { page, limit });
      const children = response.data.data || [];
      
      if (children.length === 0) {
        console.log('  ⚠️ Nenhuma criança encontrada nesta página\n');
        break;
      }
      
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
              console.log(`  ✅ ${totalUpdated} crianças atualizadas até agora...`);
            }
          } catch (error) {
            console.error(`  ❌ Erro ao atualizar criança ${child.id} (${child.name}):`, error.response?.data?.message || error.message);
          }
        }
      }
      
      if (pageUpdated > 0) {
        console.log(`  ✅ Página ${page}: ${pageUpdated} crianças atualizadas (${children.length} verificadas)\n`);
      } else {
        console.log(`  ✅ Página ${page}: Todas as ${children.length} crianças já têm joinedAt\n`);
      }
      
      page++;
      
      // Pequeno delay para não sobrecarregar a API
      if (page <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`  ❌ Erro ao processar página ${page}:`, error.response?.data?.message || error.message);
      page++;
    }
  }
  
  console.log('\n📊 ============================================');
  console.log('📊 RESUMO');
  console.log('📊 ============================================');
  console.log(`✅ Crianças verificadas: ${totalChecked}`);
  console.log(`✅ Crianças atualizadas: ${totalUpdated}`);
  console.log(`✅ Crianças que já tinham joinedAt: ${totalChecked - totalUpdated}`);
  console.log('\n🎉 Processo concluído!\n');
  
  return totalUpdated;
}

async function main() {
  console.log('🚀 ============================================');
  console.log('🚀 ATUALIZAÇÃO DE "NO CLUBINHO DESDE"');
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
  
  // Atualizar crianças
  await updateChildrenWithoutJoinedAt();
}

// Executar
main().catch(error => {
  console.error('\n❌ Erro fatal:', error.message);
  console.error(error.stack);
  process.exit(1);
});

