/**
 * Sexo da criança, como o cadastro o registra.
 *
 * A coluna é textual por herança do modelo antigo, mas só estes dois valores
 * são aceitos na entrada: antes qualquer texto de até 255 caracteres passava.
 */
export enum Gender {
  MALE = 'M',
  FEMALE = 'F',
}
