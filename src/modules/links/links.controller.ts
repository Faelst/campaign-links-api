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
import { CreateLinkDto } from "./dto/create-link.dto";
import { ListLinksQueryDto } from "./dto/list-links-query.dto";
import { UpdateLinkDto } from "./dto/update-link.dto";
import { LinksService } from "./links.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post("projects/:projectId/links")
  create(
    @CurrentUser() user: CurrentUser,
    @Param("projectId") projectId: string,
    @Body() dto: CreateLinkDto,
  ) {
    return this.linksService.create(user.sub, projectId, dto);
  }

  @Get("links")
  findAll(@CurrentUser() user: CurrentUser, @Query() query: ListLinksQueryDto) {
    return this.linksService.findAll(user.sub, query);
  }

  @Get("links/:id")
  findOne(@CurrentUser() user: CurrentUser, @Param("id") id: string) {
    return this.linksService.findOne(user.sub, id);
  }

  @Patch("links/:id")
  update(
    @CurrentUser() user: CurrentUser,
    @Param("id") id: string,
    @Body() dto: UpdateLinkDto,
  ) {
    return this.linksService.update(user.sub, id, dto);
  }

  @Delete("links/:id")
  remove(@CurrentUser() user: CurrentUser, @Param("id") id: string) {
    return this.linksService.remove(user.sub, id);
  }

  @Get("links/:id/generate")
  generate(@CurrentUser() user: CurrentUser, @Param("id") id: string) {
    return this.linksService.generate(user.sub, id);
  }
}
