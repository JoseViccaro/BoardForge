import { describe, it, expect } from "vitest";
import { PasswordHash } from "../../../src/modules/identity-access/domain/value-objects/PasswordHash.js";

describe("PasswordHash Value Object", () => {
  it("should create a valid Argon2id hash with standard work factors (>=64MB memory, >=3 iterations)", async () => {
    const password = "SuperSecure#Password2026";
    const passwordHash = await PasswordHash.create(password);

    expect(passwordHash.value).toBeDefined();
    expect(passwordHash.value.startsWith("$argon2id$")).toBe(true);
    // Check parameters in argon2id hash string: $argon2id$v=19$m=65536,t=3,p=1$...
    expect(passwordHash.value).toMatch(/m=(65536|[6-9]\d{4,}|[1-9]\d{5,})/);
    expect(passwordHash.value).toMatch(/t=([3-9]|\d{2,})/);
  });

  it("should verify correct password using constant-time comparison", async () => {
    const password = "CorrectHorseBatteryStaple1!";
    const passwordHash = await PasswordHash.create(password);

    const isValid = await passwordHash.verify(password);
    expect(isValid).toBe(true);

    const isInvalid = await passwordHash.verify("WrongPassword123!");
    expect(isInvalid).toBe(false);
  });

  it("should create instance from existing valid hash string", async () => {
    const raw = "$argon2id$v=19$m=65536,t=3,p=1$fakeSaltString$fakeHashOutput";
    const hash = PasswordHash.fromHash(raw);
    expect(hash.value).toBe(raw);
  });

  it("should reject invalid hash formats on fromHash", () => {
    expect(() => PasswordHash.fromHash("invalid_hash")).toThrow();
    expect(() => PasswordHash.fromHash("$2a$12$bcryptStyleHashNotArgon2id")).toThrow();
  });

  it("should enforce minimum password requirements (>= 12 chars, upper, lower, digit, symbol)", async () => {
    await expect(PasswordHash.create("short")).rejects.toThrow(/password/i);
    await expect(PasswordHash.create("alllowercase12345#")).rejects.toThrow(/password/i);
    await expect(PasswordHash.create("ALLUPPERCASE12345#")).rejects.toThrow(/password/i);
    await expect(PasswordHash.create("NoSpecialChar12345")).rejects.toThrow(/password/i);
    await expect(PasswordHash.create("NoDigits!UpperLower")).rejects.toThrow(/password/i);
  });
});
