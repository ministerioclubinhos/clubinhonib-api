import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

/**
 * O id vem da URL (`PATCH /informatives/:id`). Exigi-lo também no corpo fazia
 * toda edição responder 400, porque o formulário só envia os três campos.
 */
export class UpdateInformativeDto {
  @IsString()
  @IsNotEmpty({ message: 'O título é obrigatório.' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'A descrição é obrigatória.' })
  description: string;

  @IsBoolean()
  public: boolean;
}
