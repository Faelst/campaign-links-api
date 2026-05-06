import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateParameterDto } from "./dto/create-parameter.dto";
import { ListParametersQueryDto } from "./dto/list-parameters-query.dto";
import { UpdateParameterDto } from "./dto/update-parameter.dto";
import { ParametersService } from "./parameters.service";

@UseGuards(JwtAuthGuard)
@Controller("parameters")
export class ParametersController {
  constructor(private readonly parametersService: ParametersService) {}

  @Post()
  create(@CurrentUser() user: CurrentUser, @Body() dto: CreateParameterDto) {
    return this.parametersService.create(user.sub, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUser,
    @Query() query: ListParametersQueryDto,
  ) {
    return this.parametersService.findAll(user.sub, query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: CurrentUser, @Param("id") id: string) {
    return this.parametersService.findOne(user.sub, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: CurrentUser,
    @Param("id") id: string,
    @Body() dto: UpdateParameterDto,
  ) {
    return this.parametersService.update(user.sub, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: CurrentUser, @Param("id") id: string) {
    return this.parametersService.remove(user.sub, id);
  }
}
