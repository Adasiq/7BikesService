import { z } from "zod";

// ---------------------------------------------------------------------------
// Доменные перечисления — единый источник правды для API и фронта.
// Значения совпадают с enum-ами в Prisma-схеме (apps/api/prisma/schema.prisma).
// ---------------------------------------------------------------------------

export const TenantType = {
  WORKSHOP: "WORKSHOP",
  SUPPLIER: "SUPPLIER",
} as const;
export type TenantType = (typeof TenantType)[keyof typeof TenantType];

export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SUPPLIER_ADMIN: "SUPPLIER_ADMIN",
  SUPPLIER_STAFF: "SUPPLIER_STAFF",
  WORKSHOP_ADMIN: "WORKSHOP_ADMIN",
  MECHANIC: "MECHANIC",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const OrderStatus = {
  NEW: "NEW",
  ACCEPTED: "ACCEPTED",
  ASSEMBLED: "ASSEMBLED",
  SHIPPED: "SHIPPED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const WorkOrderStatus = {
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_PARTS: "WAITING_PARTS",
  DONE: "DONE",
  CLOSED: "CLOSED",
} as const;
export type WorkOrderStatus =
  (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

// ---------------------------------------------------------------------------
// Контракты API (Zod) — общие для валидации на бэке и типизации на фронте.
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
