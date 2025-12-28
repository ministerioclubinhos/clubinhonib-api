/**
 * Script para testar conexão com o RDS
 * Uso: node test-connect-rds.js
 */

const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getStackOutputs(stackName) {
    try {
        const endpoint = execSync(
            `aws cloudformation describe-stacks --stack-name ${stackName} --query 'Stacks[0].Outputs[?OutputKey==\`PublicEndpoint\`].OutputValue' --output text`,
            { encoding: 'utf-8' }
        ).trim();

        const port = execSync(
            `aws cloudformation describe-stacks --stack-name ${stackName} --query 'Stacks[0].Outputs[?OutputKey==\`DBPort\`].OutputValue' --output text`,
            { encoding: 'utf-8' }
        ).trim();

        const dbName = execSync(
            `aws cloudformation describe-stacks --stack-name ${stackName} --query 'Stacks[0].Outputs[?OutputKey==\`DBName\`].OutputValue' --output text`,
            { encoding: 'utf-8' }
        ).trim();

        const username = execSync(
            `aws cloudformation describe-stacks --stack-name ${stackName} --query 'Stacks[0].Outputs[?OutputKey==\`DBUsername\`].OutputValue' --output text`,
            { encoding: 'utf-8' }
        ).trim();

        // Obter senha do arquivo params.json (na mesma pasta)
        const paramsFile = path.join(__dirname, 'params.json');
        const params = JSON.parse(fs.readFileSync(paramsFile, 'utf-8'));
        const password = params.find(p => p.ParameterKey === 'DBPassword')?.ParameterValue;

        return { endpoint, port, dbName, username, password };
    } catch (error) {
        log('❌ Erro ao obter informações da stack', 'red');
        log(`   ${error.message}`, 'yellow');
        return null;
    }
}

async function testConnection(config) {
    log('\n╔════════════════════════════════════════════════════════╗', 'blue');
    log('║          🧪 Testando Conexão com RDS MySQL            ║', 'blue');
    log('╚════════════════════════════════════════════════════════╝', 'blue');
    log('');

    log('📋 Configuração de conexão:', 'cyan');
    log(`   Host: ${config.endpoint}`, 'green');
    log(`   Port: ${config.port}`, 'green');
    log(`   Database: ${config.dbName}`, 'green');
    log(`   Username: ${config.username}`, 'green');
    log('   Password: ********', 'green');
    log('');

    let connection;

    try {
        log('🔌 Tentando conectar...', 'yellow');

        connection = await mysql.createConnection({
            host: config.endpoint,
            port: parseInt(config.port),
            user: config.username,
            password: config.password,
            database: config.dbName,
            connectTimeout: 10000,
            ssl: false
        });

        log('✅ Conexão estabelecida com sucesso!', 'green');
        log('');

        // Testar query simples
        log('📊 Testando query...', 'yellow');
        const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as db_name, USER() as db_user');
        
        log('✅ Query executada com sucesso!', 'green');
        log('');
        log('📋 Informações do banco:', 'cyan');
        log(`   MySQL Version: ${rows[0].version}`, 'green');
        log(`   Database: ${rows[0].db_name}`, 'green');
        log(`   User: ${rows[0].db_user}`, 'green');
        log('');

        // Testar criação de tabela de teste
        log('🧪 Testando criação de tabela...', 'yellow');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS test_connection (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        log('✅ Tabela de teste criada/verificada!', 'green');
        log('');

        // Inserir e ler dados
        log('📝 Testando inserção e leitura...', 'yellow');
        await connection.execute(
            'INSERT INTO test_connection (message) VALUES (?)',
            ['Teste de conexão realizado com sucesso!']
        );

        const [testRows] = await connection.execute('SELECT * FROM test_connection ORDER BY id DESC LIMIT 1');
        log('✅ Dados inseridos e lidos com sucesso!', 'green');
        log(`   Mensagem: ${testRows[0].message}`, 'green');
        log(`   Criado em: ${testRows[0].created_at}`, 'green');
        log('');

        log('╔════════════════════════════════════════════════════════╗', 'green');
        log('║     ✅ Todos os testes de conexão passaram!           ║', 'green');
        log('╚════════════════════════════════════════════════════════╝', 'green');
        log('');

        return true;

    } catch (error) {
        log('╔════════════════════════════════════════════════════════╗', 'red');
        log('║            ❌ Erro ao conectar ao RDS                  ║', 'red');
        log('╚════════════════════════════════════════════════════════╝', 'red');
        log('');
        log(`Erro: ${error.message}`, 'red');
        log('');

        if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            log('💡 Possíveis causas:', 'yellow');
            log('   - O RDS ainda está sendo criado (aguarde alguns minutos)', 'yellow');
            log('   - Security Group não permite acesso do seu IP', 'yellow');
            log('   - Endpoint incorreto', 'yellow');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            log('💡 Possíveis causas:', 'yellow');
            log('   - Username ou senha incorretos', 'yellow');
            log('   - Usuário não tem permissões', 'yellow');
        }

        return false;
    } finally {
        if (connection) {
            await connection.end();
            log('🔌 Conexão encerrada.', 'cyan');
        }
    }
}

async function main() {
    const stackName = 'geral-aplications-rds';

    log('🔍 Obtendo informações da stack CloudFormation...', 'blue');
    const config = await getStackOutputs(stackName);

    if (!config || !config.endpoint) {
        log('❌ Não foi possível obter as informações da stack', 'red');
        log(`   Verifique se a stack "${stackName}" existe e está completa`, 'yellow');
        process.exit(1);
    }

    const success = await testConnection(config);
    process.exit(success ? 0 : 1);
}

main().catch(error => {
    log(`\n❌ Erro fatal: ${error.message}`, 'red');
    process.exit(1);
});

