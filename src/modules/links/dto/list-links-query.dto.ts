import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";

import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListLinksQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @Transform(({ obj }) => {
    if (obj.hasRedirect === "true") return true;
    if (obj.hasRedirect === "false") return false;

    return obj.hasRedirect;
  })
  hasRedirect?: boolean;
}
