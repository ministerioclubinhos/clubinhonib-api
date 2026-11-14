/**
 * Contrato de resposta de `/contact`.
 *
 * Antes a rota devolvia `ContactEntity` cru; agora o que sai é declarado aqui.
 */
export class ContactResponseDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}
