import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export const ROLES_KEY = "roles";

// Ограничивает маршрут перечисленными ролями. Без декоратора — доступ любой
// аутентифицированной роли.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
