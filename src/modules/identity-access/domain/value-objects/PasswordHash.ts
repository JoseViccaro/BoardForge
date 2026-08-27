import argon2 from "argon2";

export class PasswordHash {
  private constructor(public readonly value: string) {}

  public static validatePasswordComplexity(password: string): void {
    if (typeof password !== "string" || password.length < 12) {
      throw new Error("Password must be at least 12 characters long.");
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      throw new Error(
        "Password must contain uppercase, lowercase, numeric, and special characters."
      );
    }
  }

  public static async create(password: string): Promise<PasswordHash> {
    this.validatePasswordComplexity(password);

    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });

    return new PasswordHash(hash);
  }

  public static fromHash(hashString: string): PasswordHash {
    if (!hashString || typeof hashString !== "string" || !hashString.startsWith("$argon2id$")) {
      throw new Error("Invalid Argon2id hash format");
    }
    return new PasswordHash(hashString);
  }

  public async verify(password: string): Promise<boolean> {
    try {
      return await argon2.verify(this.value, password);
    } catch {
      return false;
    }
  }
}
