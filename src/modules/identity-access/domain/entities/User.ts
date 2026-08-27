import { randomUUID } from "node:crypto";
import { UserRole } from "../value-objects/UserRole.js";
import { PasswordHash } from "../value-objects/PasswordHash.js";

export interface UserProps {
  id?: string;
  organizationId: string;
  email: string;
  passwordHash: PasswordHash;
  role: UserRole;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  public readonly id: string;
  public readonly organizationId: string;
  public email: string;
  public passwordHash: PasswordHash;
  public role: UserRole;
  public isActive: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id ?? randomUUID();
    this.organizationId = props.organizationId;
    this.email = props.email.toLowerCase().trim();
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public static create(params: {
    organizationId: string;
    email: string;
    passwordHash: PasswordHash;
    role: UserRole;
    isActive?: boolean;
  }): User {
    return new User({
      organizationId: params.organizationId,
      email: params.email,
      passwordHash: params.passwordHash,
      role: params.role,
      isActive: params.isActive,
    });
  }
}
