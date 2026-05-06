import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Cache } from "@nestjs/cache-manager";
import {
  buildPagination,
  paginatedResponse,
} from "../../common/dto/pagination-query.dto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { CreateLinkDto, InlineParameterDto } from "./dto/create-link.dto";
import { ListLinksQueryDto } from "./dto/list-links-query.dto";
import { UpdateLinkDto } from "./dto/update-link.dto";
import { FinalLinkBuilderService } from "./services/final-link-builder.service";

const linkInclude = {
  project: true,
  redirect: true,
  linkParameters: {
    include: { parameter: true },
    orderBy: { position: "asc" as const },
  },
};

@Injectable()
export class LinksService {
  private readonly logger = new Logger(LinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly finalLinkBuilderService: FinalLinkBuilderService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(userId: string, projectId: string, dto: CreateLinkDto) {
    await this.projectsService.findOne(userId, projectId);

    const parameterIds = await this.resolveParameters(
      userId,
      dto.parameterIds,
      dto.parameters,
    );

    const link = await this.prisma.link.create({
      data: {
        name: dto.name,
        baseUrl: dto.baseUrl,
        projectId,
        redirect: dto.redirect
          ? {
              create: {
                targetUrl: dto.redirect.targetUrl,
                paramKey: dto.redirect.paramKey ?? "redirect",
                statusCode: dto.redirect.statusCode ?? 302,
              },
            }
          : undefined,
        linkParameters: {
          create: parameterIds.map((parameterId, index) => ({
            parameterId,
            position: index,
          })),
        },
      },
      include: linkInclude,
    });

    this.logger.log(
      `Link created id=${link.id} projectId=${projectId} userId=${userId}`,
    );
    return link;
  }

  async findAll(userId: string, query: ListLinksQueryDto) {
    const { skip, take, page, limit } = buildPagination(
      query.page,
      query.limit,
    );
    const where: Prisma.LinkWhereInput = {
      project: { userId, ...(query.projectId ? { id: query.projectId } : {}) },
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { baseUrl: { contains: query.search } },
            ],
          }
        : {}),
      ...(typeof query.hasRedirect === "boolean"
        ? query.hasRedirect
          ? { redirect: { isNot: null } }
          : { redirect: null }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.link.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: linkInclude,
      }),
      this.prisma.link.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  async findOne(userId: string, id: string) {
    const link = await this.prisma.link.findFirst({
      where: { id, project: { userId } },
      include: linkInclude,
    });

    if (!link) {
      throw new NotFoundException("Link not found");
    }

    return link;
  }

  async update(userId: string, id: string, dto: UpdateLinkDto) {
    const currentLink = await this.findOne(userId, id);

    const shouldSyncParameters = Boolean(dto.parameterIds || dto.parameters);
    const parameterIds = shouldSyncParameters
      ? await this.resolveParameters(userId, dto.parameterIds, dto.parameters)
      : [];

    const updatedLink = await this.prisma.$transaction(async (tx) => {
      if (shouldSyncParameters) {
        await tx.linkParameter.deleteMany({ where: { linkId: id } });
        await tx.linkParameter.createMany({
          data: parameterIds.map((parameterId, index) => ({
            linkId: id,
            parameterId,
            position: index,
          })),
        });
      }

      if (dto.removeRedirect) {
        await tx.redirectConfig.deleteMany({ where: { linkId: id } });
      }

      if (dto.redirect && !dto.removeRedirect) {
        await tx.redirectConfig.upsert({
          where: { linkId: id },
          update: {
            targetUrl: dto.redirect.targetUrl,
            paramKey:
              dto.redirect.paramKey ??
              currentLink.redirect?.paramKey ??
              "redirect",
            statusCode:
              dto.redirect.statusCode ??
              currentLink.redirect?.statusCode ??
              302,
          },
          create: {
            linkId: id,
            targetUrl: dto.redirect.targetUrl,
            paramKey: dto.redirect.paramKey ?? "redirect",
            statusCode: dto.redirect.statusCode ?? 302,
          },
        });
      }

      return tx.link.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.baseUrl ? { baseUrl: dto.baseUrl } : {}),
        },
        include: linkInclude,
      });
    });

    await this.invalidateGeneratedLinkCache(userId, id);
    this.logger.log(`Link updated id=${id} userId=${userId}`);

    return updatedLink;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.link.delete({ where: { id } });
    await this.invalidateGeneratedLinkCache(userId, id);

    this.logger.log(`Link removed id=${id} userId=${userId}`);
    return { deleted: true };
  }

  async generate(userId: string, id: string) {
    const link = await this.findOne(userId, id);

    const cacheKey = this.generateCacheKey(
      userId,
      id,
      link.updatedAt.toISOString(),
    );

    const cached = await this.cacheManager.get<{
      url: string;
      cached: boolean;
    }>(cacheKey);

    if (cached) {
      this.logger.log(`Generated link cache hit id=${id} userId=${userId}`);
      return { ...cached, cached: true };
    }

    const url = this.finalLinkBuilderService.build(
      link.baseUrl,
      link.linkParameters.map(({ parameter }) => ({
        key: parameter.key,
        value: parameter.value,
      })),
      link.redirect,
    );

    const response = {
      url,
      cached: false,
      linkId: id,
      generatedAt: new Date().toISOString(),
    };

    await this.cacheManager.set(cacheKey, response, 60_000);

    this.logger.log(`Generated link cache set id=${id} userId=${userId}`);

    return response;
  }

  private async resolveParameters(
    userId: string,
    parameterIds?: string[],
    inlineParameters?: InlineParameterDto[],
  ): Promise<string[]> {
    const existingParameterIds = parameterIds ?? [];

    if (existingParameterIds.length) {
      const count = await this.prisma.parameter.count({
        where: { id: { in: existingParameterIds }, userId },
      });

      if (count !== existingParameterIds.length) {
        throw new NotFoundException("One or more parameters were not found");
      }
    }

    const createdOrFoundIds: string[] = [];

    for (const parameter of inlineParameters ?? []) {
      const saved = await this.prisma.parameter.upsert({
        where: {
          userId_key_value: {
            userId,
            key: parameter.key.trim(),
            value: parameter.value.trim(),
          },
        },
        update: {},
        create: {
          userId,
          key: parameter.key.trim(),
          value: parameter.value.trim(),
        },
      });

      createdOrFoundIds.push(saved.id);
    }

    return Array.from(new Set([...existingParameterIds, ...createdOrFoundIds]));
  }

  private generateCacheKey(userId: string, linkId: string, updatedAt: string) {
    return `generated-link:${userId}:${linkId}:${updatedAt}`;
  }

  private async invalidateGeneratedLinkCache(userId: string, linkId: string) {
    const store = this.cacheManager.store as unknown as {
      keys?: () => Promise<string[]>;
      del?: (key: string) => Promise<void>;
    };

    if (!store.keys || !store.del) return;

    const keys = await store.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(`generated-link:${userId}:${linkId}:`))
        .map((key) => this.cacheManager.del(key)),
    );
  }
}
