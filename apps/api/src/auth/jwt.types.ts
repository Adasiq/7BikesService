import { UserRole } from "@prisma/client";

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  tenantId: string | null;
}

// Форма, которую кладём в request.user после успешной проверки токена.
export type RequestUser = JwtPayload;
