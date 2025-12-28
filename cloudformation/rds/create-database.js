/**
 * Script para criar banco de dados no RDS
 * Uso: node create-database.js [nome-do-banco]
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

        const username = execSync(
            `aws cloudformation describe-stacks --stack-name ${stackName} --query 'Stacks[0].Outputs[?OutputKey==\`DBUsername\`].OutputValue' --output text`,
            { encoding: 'utf-8' }
        ).trim();

        // Obter senha do arquivo params.json (na mesma pasta)
        const paramsFile = path.join(__dirname, 'params.json');
        const params = JSON.parse(fs.readFileSync(paramsFile, 'utf-8'));
        const password = params.find(p => p.ParameterKey === 'DBPassword')?.ParameterValue;

        return { endpoint, port, username, password };
    } catch (error) {
        log('❌ Erro ao obter informações da stack', 'red');
        log(`   ${error.message}`, 'yellow');
        return null;
    }
}

async function createDatabase(config, dbName) {
    log('\n╔════════════════════════════════════════════════════════╗', 'blue');
    log('║          🗄️  Criando Banco de Dados no RDS             ║', 'blue');
    log('╚════════════════════════════════════════════════════════╝', 'blue');
    log('');

    log(`📋 Criando banco: ${dbName}`, 'cyan');
    log(`   Host: ${config.endpoint}`, 'green');
    log('');

    let connection;

    try {
        log('🔌 Conectando ao RDS...', 'yellow');

        // Conectar sem especificar database (conecta ao mysql padrão)
        connection = await mysql.createConnection({
            host: config.endpoint,
            port: parseInt(config.port),
            user: config.username,
            password: config.password,
            connectTimeout: 10000,
            ssl: false
        });

        log('✅ Conectado com sucesso!', 'green');
        log('');

        // Verificar se o banco já existe
        log('🔍 Verificando se o banco já existe...', 'yellow');
        const [existingDbs] = await connection.execute(
            `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [dbName]
        );

        if (existingDbs.length > 0) {
            log(`⚠️  Banco de dados '${dbName}' já existe!`, 'yellow');
            log('   Nenhuma ação necessária.', 'cyan');
            return true;
        }

        // Criar banco de dados
        log(`📝 Criando banco de dados '${dbName}'...`, 'yellow');
        await connection.execute(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        
        log(`✅ Banco de dados '${dbName}' criado com sucesso!`, 'green');
        log('');

        // Verificar criação
        log('🔍 Verificando criação...', 'yellow');
        const [dbs] = await connection.execute(
            `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [dbName]
        );

        if (dbs.length > 0) {
            log('✅ Banco de dados confirmado!', 'green');
            log('');
            log('📋 Informações:', 'cyan');
            log(`   Nome: ${dbName}`, 'green');
            log(`   Charset: utf8mb4`, 'green');
            log(`   Collation: utf8mb4_unicode_ci`, 'green');
            log('');

            log('╔════════════════════════════════════════════════════════╗', 'green');
            log('║     ✅ Banco de dados criado com sucesso!              ║', 'green');
            log('╚════════════════════════════════════════════════════════╝', 'green');
            log('');

            return true;
        } else {
            log('❌ Erro: Banco não foi criado corretamente', 'red');
            return false;
        }

    } catch (error) {
        log('╔════════════════════════════════════════════════════════╗', 'red');
        log('║        ❌ Erro ao criar banco de dados                 ║', 'red');
        log('╚════════════════════════════════════════════════════════╝', 'red');
        log('');
        log(`Erro: ${error.message}`, 'red');
        log('');

        if (error.code === 'ER_DB_CREATE_EXISTS') {
            log('💡 O banco de dados já existe.', 'yellow');
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
    const dbName = process.argv[2] || 'clubinho-nib-staging';

    log('🔍 Obtendo informações da stack CloudFormation...', 'blue');
    const config = await getStackOutputs(stackName);

    if (!config || !config.endpoint) {
        log('❌ Não foi possível obter as informações da stack', 'red');
        log(`   Verifique se a stack "${stackName}" existe e está completa`, 'yellow');
        process.exit(1);
    }

    const success = await createDatabase(config, dbName);
    process.exit(success ? 0 : 1);
}

main().catch(error => {
    log(`\n❌ Erro fatal: ${error.message}`, 'red');
    process.exit(1);
});

