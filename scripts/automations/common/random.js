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

module.exports = {
  randomName,
  randomEmail,
  randomPhone,
  randomBirthDate,
  randomJoinedAt,
  randomGender,
  randomClubNumber,
  randomWeekday,
  randomTime,
  randomAddress,
};


