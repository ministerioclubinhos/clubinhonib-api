const crypto = require('node:crypto');
const { EMAIL_DOMAIN } = require('./config');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const FIRST_NAMES = ['João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Julia', 'Lucas', 'Sofia', 'Gabriel', 'Isabella', 'Rafael', 'Larissa', 'Felipe', 'Mariana', 'Bruno', 'Camila', 'Thiago', 'Beatriz', 'Gustavo', 'Amanda', 'Henrique', 'Laura', 'Matheus', 'Fernanda', 'Rodrigo', 'Patricia', 'André', 'Juliana', 'Ricardo', 'Vanessa'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Mendes', 'Barbosa', 'Ferreira', 'Cardoso', 'Reis', 'Dias', 'Cavalcanti', 'Ramos', 'Freitas', 'Moraes', 'Teixeira'];

function uniqueSuffix() {
  return `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function randomEmail(prefix = 'teste') {
  return `${prefix}.${uniqueSuffix()}@${EMAIL_DOMAIN}`.toLowerCase();
}

function randomPhone() {
  const ddd = pick(['11', '21', '31', '41', '47', '48', '51', '61', '71', '81', '85', '92']);
  return `${ddd}9${Math.floor(10000000 + Math.random() * 90000000)}`;
}

function randomCpf() {
  return String(Math.floor(10000000000 + Math.random() * 89999999999));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateOnly(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Nascimento entre 4 e 14 anos atrás. */
function randomBirthDate() {
  const year = new Date().getFullYear() - (4 + Math.floor(Math.random() * 11));
  return `${year}-${pad2(Math.floor(Math.random() * 12) + 1)}-${pad2(Math.floor(Math.random() * 28) + 1)}`;
}

/** Nascimento de adulto (perfil de professor/coordenador). */
function randomAdultBirthDate() {
  const year = new Date().getFullYear() - (20 + Math.floor(Math.random() * 40));
  return `${year}-${pad2(Math.floor(Math.random() * 12) + 1)}-${pad2(Math.floor(Math.random() * 28) + 1)}`;
}

/** Entrada no clubinho entre 2020 e hoje. */
function randomJoinedAt() {
  const start = new Date('2020-01-01T12:00:00');
  const end = new Date();
  return toDateOnly(new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())));
}

/** Entrada dentro de um período letivo (para gerar pagelas parciais). */
function randomJoinedAtWithin(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return toDateOnly(new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())));
}

function randomGender() {
  return Math.random() > 0.5 ? 'M' : 'F';
}

function randomClubNumber() {
  return Math.floor(1000 + Math.random() * 9000);
}

function randomWeekday() {
  return pick(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
}

/** `HH:mm` entre 08:00 e 19:30. */
function randomTime() {
  return `${pad2(8 + Math.floor(Math.random() * 12))}:${pick(['00', '30'])}`;
}

function randomAddress() {
  const streets = ['Rua das Flores', 'Avenida Principal', 'Rua Central', 'Avenida Brasil', 'Rua do Comércio', 'Avenida Paulista', 'Rua da Paz', 'Avenida dos Estados', 'Rua São Paulo', 'Avenida Getúlio Vargas'];
  const districts = ['Centro', 'Jardim das Flores', 'Vila Nova', 'Bairro Novo', 'Parque Industrial', 'Alto da Boa Vista', 'São José', 'Nova Esperança', 'Jardim América', 'Vila Rica'];
  const cities = [['São Paulo', 'SP'], ['Rio de Janeiro', 'RJ'], ['Belo Horizonte', 'MG'], ['Curitiba', 'PR'], ['Porto Alegre', 'RS'], ['Brasília', 'DF'], ['Salvador', 'BA'], ['Manaus', 'AM'], ['Fortaleza', 'CE'], ['Recife', 'PE']];
  const [city, state] = pick(cities);
  return {
    street: pick(streets),
    number: String(Math.floor(Math.random() * 9999) + 1),
    district: pick(districts),
    city,
    state,
    postalCode: String(Math.floor(10000000 + Math.random() * 90000000)),
    complement: Math.random() > 0.5 ? `Apto ${Math.floor(Math.random() * 500) + 1}` : undefined,
  };
}

module.exports = {
  pick,
  uniqueSuffix,
  randomName,
  randomEmail,
  randomPhone,
  randomCpf,
  randomBirthDate,
  randomAdultBirthDate,
  randomJoinedAt,
  randomJoinedAtWithin,
  randomGender,
  randomClubNumber,
  randomWeekday,
  randomTime,
  randomAddress,
  toDateOnly,
  pad2,
};
