import { RoleName } from "@components/role/v1/role.interface";

export enum Resource {
  TEAM = "team",
  CHAT = "chat",
  EVENT = "event",
  RSVP = "rsvp",
  ATTENDANCE = "attendance",
  GAME_NOTE = "gameNote",
  PAYMENT = "payment",
  GUARDIAN_LINK = "guardianLink",
  PLAYER = "player",
}

export enum Action {
  VIEW = "view",
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  MANAGE = "manage",
  PIN = "pin",
  PUBLISH = "publish",
  APPROVE = "approve",
  PAY = "pay",
  REFUND = "refund",
}

export interface PermissionContext {
  userId: string;
  teamId: string;
  resource: Resource;
  action: Action;
  resourceOwnerId?: string; // For ownership checks
  targetUserId?: string; // For checking if action is on self
  playerId?: string; // For guardian-player checks
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}
