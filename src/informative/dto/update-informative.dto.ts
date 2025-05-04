import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

export class UpdateInformativeDto {
    @IsString()
    @IsNotEmpty({ message: 'O id é obrigatório.' })
    id: string;

    @IsString()
    @IsNotEmpty({ message: 'O título é obrigatório.' })
    title: string;

    @IsString()
    @IsNotEmpty({ message: 'A descrição é obrigatória.' })
    description: string;

    @IsBoolean()
    public: boolean;
}
