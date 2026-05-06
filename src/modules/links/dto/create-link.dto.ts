import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InlineParameterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  value: string;
}

export class RedirectConfigDto {
  @IsUrl({ require_tld: false })
  targetUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paramKey?: string = 'redirect';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(300)
  @Max(399)
  statusCode?: number = 302;
}

export class CreateLinkDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsUrl({ require_tld: false })
  baseUrl: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  parameterIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InlineParameterDto)
  parameters?: InlineParameterDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RedirectConfigDto)
  redirect?: RedirectConfigDto;
}
