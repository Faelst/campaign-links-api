import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.linkParameter.deleteMany();
  await prisma.redirectConfig.deleteMany();
  await prisma.link.deleteMany();
  await prisma.parameter.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('123456', 10);

  const jose = await prisma.user.create({
    data: {
      name: 'José',
      email: 'jose@example.com',
      password,
    },
  });

  const david = await prisma.user.create({
    data: {
      name: 'David',
      email: 'david@example.com',
      password,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: 'Black Friday',
      description: 'Campanhas pagas de aquisição',
      userId: jose.id,
    },
  });

  const params = await Promise.all([
    prisma.parameter.create({ data: { key: 'utm_source', value: 'FB', userId: jose.id } }),
    prisma.parameter.create({ data: { key: 'utm_medium', value: 'paid_social', userId: jose.id } }),
    prisma.parameter.create({ data: { key: 'utm_campaign', value: 'black_friday', userId: jose.id } }),
  ]);

  const link = await prisma.link.create({
    data: {
      name: 'Landing principal',
      baseUrl: 'https://example.com',
      projectId: project.id,
      redirect: {
        create: {
          targetUrl: 'https://checkout.example.com/oferta',
          paramKey: 'redirect',
          statusCode: 302,
        },
      },
      linkParameters: {
        create: params.map((param, index) => ({
          parameterId: param.id,
          position: index,
        })),
      },
    },
  });

  await prisma.project.create({
    data: {
      name: 'Conteúdo orgânico',
      description: 'Links editoriais',
      userId: david.id,
    },
  });

  console.log('Seed executado com sucesso');
  console.table([
    { email: jose.email, password: '123456', sampleLinkId: link.id },
    { email: david.email, password: '123456', sampleLinkId: '-' },
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
