import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";

describe("AuthService", () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, "create" | "findByEmail">>;
  let jwtService: jest.Mocked<Pick<JwtService, "sign">>;

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue("signed-token"),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  it("should register user and return access token", async () => {
    usersService.create.mockResolvedValue({
      id: "user-1",
      name: "José",
      email: "jose@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.register({
      name: "José",
      email: "jose@example.com",
      password: "123456",
    });

    expect(usersService.create).toHaveBeenCalledWith({
      name: "José",
      email: "jose@example.com",
      password: "123456",
    });
    expect(result.accessToken).toBe("signed-token");
    expect(result.user.email).toBe("jose@example.com");
  });

  it("should login with valid credentials", async () => {
    const hashedPassword = await bcrypt.hash("123456", 10);
    usersService.findByEmail.mockResolvedValue({
      id: "user-1",
      name: "José",
      email: "jose@example.com",
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.login({
      email: "jose@example.com",
      password: "123456",
    });

    expect(result.accessToken).toBe("signed-token");
    expect(result.user).not.toHaveProperty("password");
  });

  it("should reject invalid credentials", async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: "missing@example.com", password: "123456" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
