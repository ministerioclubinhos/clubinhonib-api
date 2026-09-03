/** Contrato de resposta de `/comments`. */
export class CommentResponseDto {
  id: string;
  name: string;
  comment: string;
  clubinho: string;
  neighborhood: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}
