import { IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListParametersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  key?: string;
}
