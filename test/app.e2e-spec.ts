import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/common/prisma/prisma.service";

describe("Campaign Links API (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function registerAndLogin(email: string) {
    const response = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ name: email.split("@")[0], email, password: "123456" })
      .expect(201);

    return response.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.linkParameter.deleteMany();
    await prisma.redirectConfig.deleteMany();
    await prisma.link.deleteMany();
    await prisma.parameter.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should create project, create link and generate final URL", async () => {
    const token = await registerAndLogin("jose@example.com");

    const projectResponse = await request(app.getHttpServer())
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Black Friday", description: "Campanha de aquisição" })
      .expect(201);

    const linkResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectResponse.body.id}/links`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Landing principal",
        baseUrl: "https://example.com",
        parameters: [
          { key: "utm_source", value: "FB" },
          { key: "utm_medium", value: "paid_social" },
        ],
        redirect: {
          targetUrl: "https://checkout.example.com/oferta",
          paramKey: "redirect",
        },
      })
      .expect(201);

    const generateResponse = await request(app.getHttpServer())
      .get(`/api/links/${linkResponse.body.id}/generate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(generateResponse.body.url).toContain("https://example.com/");
    expect(generateResponse.body.url).toContain("utm_source=FB");
    expect(generateResponse.body.url).toContain("utm_medium=paid_social");
    expect(generateResponse.body.url).toContain(
      "redirect=https%3A%2F%2Fcheckout.example.com%2Foferta",
    );
  });

  it("should validate payloads", async () => {
    const token = await registerAndLogin("david@example.com");

    await request(app.getHttpServer())
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "A", extra: "field-not-allowed" })
      .expect(400);
  });

  it("should paginate and filter links", async () => {
    const token = await registerAndLogin("jose@example.com");

    const projectResponse = await request(app.getHttpServer())
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "CRM" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/projects/${projectResponse.body.id}/links`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Newsletter", baseUrl: "https://example.com/news" })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get("/api/links?page=1&limit=10&search=News&hasRedirect=false")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  it("should paginate and filter links with redirect", async () => {
    const token = await registerAndLogin("jose@example.com");

    const projectResponse = await request(app.getHttpServer())
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "CRM" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/projects/${projectResponse.body.id}/links`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Newsletter",
        baseUrl: "https://example.com/news",
        redirect: { targetUrl: "https://example.com/redirect", paramKey: "r" },
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get("/api/links?page=1&limit=10&search=News&hasRedirect=true")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  it("should isolate data by authenticated user", async () => {
    const joseToken = await registerAndLogin("jose@example.com");
    const davidToken = await registerAndLogin("david@example.com");

    const projectResponse = await request(app.getHttpServer())
      .post("/api/projects")
      .set("Authorization", `Bearer ${joseToken}`)
      .send({ name: "Private project" })
      .expect(201);

    const linkResponse = await request(app.getHttpServer())
      .post(`/api/projects/${projectResponse.body.id}/links`)
      .set("Authorization", `Bearer ${joseToken}`)
      .send({ name: "Private link", baseUrl: "https://example.com/private" })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/links/${linkResponse.body.id}/generate`)
      .set("Authorization", `Bearer ${davidToken}`)
      .expect(404);
  });
});
