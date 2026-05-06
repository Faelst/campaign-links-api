import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class CreateParameterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9_\-.]+$/, {
    message: 'key must contain only letters, numbers, underscore, dash or dot',
  })
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  value: string;
}
