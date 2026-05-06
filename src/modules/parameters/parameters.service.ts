import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { buildPagination, paginatedResponse } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateParameterDto } from './dto/create-parameter.dto';
import { ListParametersQueryDto } from './dto/list-parameters-query.dto';
import { UpdateParameterDto } from './dto/update-parameter.dto';

@Injectable()
export class ParametersService {
  private readonly logger = new Logger(ParametersService.name);

  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateParameterDto) {
    this.logger.log(`Parameter created key=${dto.key} userId=${userId}`);

    return this.prisma.parameter.create({
      data: {
        key: dto.key.trim(),
        value: dto.value.trim(),
        userId,
      },
    });
  }

  async findAll(userId: string, query: ListParametersQueryDto) {
    const { skip, take, page, limit } = buildPagination(query.page, query.limit);
    const where: Prisma.ParameterWhereInput = {
      userId,
      ...(query.key ? { key: { contains: query.key } } : {}),
      ...(query.search
        ? {
            OR: [
              { key: { contains: query.search } },
              { value: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.parameter.findMany({
        where,
        skip,
        take,
        orderBy: [{ key: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.parameter.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  async findOne(userId: string, id: string) {
    const parameter = await this.prisma.parameter.findFirst({ where: { id, userId } });

    if (!parameter) {
      throw new NotFoundException('Parameter not found');
    }

    return parameter;
  }

  async update(userId: string, id: string, dto: UpdateParameterDto) {
    await this.findOne(userId, id);

    return this.prisma.parameter.update({
      where: { id },
      data: {
        ...(dto.key ? { key: dto.key.trim() } : {}),
        ...(dto.value ? { value: dto.value.trim() } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.parameter.delete({ where: { id } });

    this.logger.log(`Parameter removed id=${id} userId=${userId}`);
    return { deleted: true };
  }
}
