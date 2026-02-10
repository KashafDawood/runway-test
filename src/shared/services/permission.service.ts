import { UserRole } from "../../components/userRole/v1/userRole.model";
import { GuardianLink } from "../../components/guardianLink/v1/guardianLink.model";
import { RoleName } from "../../components/role/v1/role.interface";
import { GuardianLinkStatus } from "../../components/guardianLink/v1/guardianLink.interface";
import { Player } from "../../components/player/v1/player.model";
import {
  Resource,
  Action,
  PermissionContext,
  PermissionResult,
} from "../types/permission.types";

export class PermissionService {
  /**
   * Check if user has permission to perform action on resource in team context
   */
  async checkPermission(context: PermissionContext): Promise<PermissionResult> {
    const { userId, teamId, resource } = context;

    // Get user's role in this team
    const userRole = await this.getUserRoleInTeam(userId, teamId);

    if (!userRole) {
      return {
        allowed: false,
        reason: "User is not a member of this team",
      };
    }

    // Admin roles (coach, assistant_coach) have most permissions
    const isAdmin =
      userRole === RoleName.COACH || userRole === RoleName.ASSISTANT_COACH;

    // Check permission based on resource and action
    switch (resource) {
      case Resource.TEAM:
        return this.checkTeamPermission(context, userRole, isAdmin);

      case Resource.CHAT:
        return this.checkChatPermission(context, userRole, isAdmin);

      case Resource.EVENT:
        return this.checkEventPermission(context, userRole, isAdmin);

      case Resource.RSVP:
        return this.checkRSVPPermission(context, userRole, isAdmin);

      case Resource.ATTENDANCE:
        return this.checkAttendancePermission(context, userRole, isAdmin);

      case Resource.GAME_NOTE:
        return this.checkGameNotePermission(context, userRole, isAdmin);

      case Resource.PAYMENT:
        return this.checkPaymentPermission(context, userRole, isAdmin);

      case Resource.GUARDIAN_LINK:
        return this.checkGuardianLinkPermission(context, userRole, isAdmin);

      case Resource.PLAYER:
        return this.checkPlayerPermission(context, userRole, isAdmin);

      default:
        return { allowed: false, reason: "Unknown resource" };
    }
  }

  /**
   * Get user's role in specific team
   */
  private async getUserRoleInTeam(
    userId: string,
    teamId: string,
  ): Promise<RoleName | null> {
    const userRole = await UserRole.findOne({
      userId,
      teamId,
      status: "active",
    }).select("roleName");

    return userRole ? userRole.roleName : null;
  }

  /**
   * Check if user is a guardian of specific player in team
   */
  private async isGuardianOfPlayer(
    guardianId: string,
    playerId: string,
    teamId: string,
  ): Promise<boolean> {
    const link = await GuardianLink.findOne({
      guardianId,
      playerId,
      teamId,
      status: GuardianLinkStatus.APPROVED,
    });

    return !!link;
  }

  // Permission checks for each resource type

  private checkTeamPermission(
    context: PermissionContext,
    userRole: RoleName,
    isAdmin: boolean,
  ): PermissionResult {
    const { action, resourceOwnerId, userId } = context;

    switch (action) {
      case Action.VIEW:
        return { allowed: true }; // All team members can view

      case Action.CREATE:
        return { allowed: isAdmin }; // Only admins can create teams

      case Action.UPDATE:
        if (!isAdmin) return { allowed: false };
        // Admins can update, creator can always update
        if (resourceOwnerId && resourceOwnerId === userId) {
          return { allowed: true };
        }
        return { allowed: isAdmin };

      case Action.DELETE:
        // Only creator can delete
        return {
          allowed: resourceOwnerId === userId,
          reason: "Only team creator can delete",
        };

      case Action.MANAGE:
        return { allowed: isAdmin }; // Manage members

      default:
        return { allowed: false };
    }
  }

  private checkChatPermission(
    context: PermissionContext,
    userRole: RoleName,
    isAdmin: boolean,
  ): PermissionResult {
    const { action, resourceOwnerId, userId } = context;

    switch (action) {
      case Action.VIEW:
      case Action.CREATE:
        return { allowed: true }; // All members can view and send messages

      case Action.PIN:
        return { allowed: isAdmin }; // Only admins can pin

      case Action.DELETE:
        // Admins can delete any, users can delete own
        return {
          allowed: isAdmin || resourceOwnerId === userId,
        };

      default:
        return { allowed: false };
    }
  }

  private checkEventPermission(
    context: PermissionContext,
    userRole: RoleName,
    isAdmin: boolean,
  ): PermissionResult {
    const { action } = context;

    switch (action) {
      case Action.VIEW:
        return { allowed: true }; // All members can view events

      case Action.CREATE:
      case Action.UPDATE:
      case Action.DELETE:
        return { allowed: isAdmin }; // Only admins can manage events

      default:
        return { allowed: false };
    }
  }

  private async checkRSVPPermission(
    context: PermissionContext,
    userRole: RoleName,
    isAdmin: boolean,
  ): Promise<PermissionResult> {
    const { action, targetUserId, playerId, userId, teamId } = context;

    switch (action) {
      case Action.VIEW:
        // Admins see all, players see own, guardians see linked players
        if (isAdmin) return { allowed: true };
        if (targetUserId === userId) return { allowed: true };
        if (playerId && userRole === RoleName.GUARDIAN) {
          const isGuardian = await this.isGuardianOfPlayer(
            userId,
            playerId,
            teamId,
          );
          return { allowed: isGuardian };
        }
        return { allowed: false };

      case Action.CREATE:
      case Action.UPDATE:
        // Users can update own RSVP
        if (targetUserId === userId) return { allowed: true };
        // Guardians can update linked player's RSVP
        if (playerId && userRole === RoleName.GUARDIAN) {
          const isGuardian = await this.isGuardianOfPlayer(
            userId,
            playerId,
            teamId,
          );
          return { allowed: isGuardian };
        }
        return { allowed: false };

      default:
        return { allowed: false };
    }
  }

  private async checkAttendancePermission(
    context: PermissionContext,
    userRole: RoleName,
    isAdmin: boolean,
  ): Promise<PermissionResult> {
    const { action, targetUserId, playerId, userId, teamId } = context;

    switch (action) {
      case Action.VIEW:
        // Admins see all
        if (isAdmin) return { allowed: true };
        // Players see own
        if (targetUserId === userId) return { allowed: true };
        // Guardians see linked players
        if (playerId && userRole === RoleName.GUARDIAN) {
          const isGuardian = await this.isGuardianOfPlayer(
            userId,
            playerId,
            teamId,
          );
          return { allowed: isGuardian };
        }
        return { allowed: false };

      case Action.CREATE:
      case Action.UPDATE:
      case Action.DELETE:
        return { allowed: isAdmin }; // Only admins can take attendance

      default:
        return { allowed: false };
    }
  }

  private async checkGameNotePermission(
    context: PermissionContext,
    userRole: RoleName,
    isAdmin: boolean,
  ): Promise<PermissionResult> {
    const { action, playerId, userId, teamId } = context;

    switch (action) {
      case Action.VIEW:
        // Admins see all
        if (isAdmin) return { allowed: true };
        // Players see own notes only - verify playerId belongs to this user in this team
        if (userRole === RoleName.PLAYER && playerId) {
          const player = await Player.findOne({
            _id: playerId,
            teamId,
            userId,
          }).select("_id");

          return {
            allowed: !!player,
            reason: !player ? "Not allowed to view notes for this player" : undefined,
          };
        }
        // Guardians see linked player notes
        if (playerId && userRole === RoleName.GUARDIAN) {
          const isGuardian = await this.isGuardianOfPlayer(
            userId,
            playerId,
            teamId,
          );
          return { allowed: isGuardian };
        }
        return { allowed: false };

      case Action.CREATE:
      case Action.UPDATE:
      case Action.DELETE:
      case Action.PUBLISH:
        return { allowed: isAdmin }; // Only admins can manage game notes

      default:
        return { allowed: false };
    }
  }

  private async checkPaymentPermission(
    context: PermissionContext,
    userRole: RoleName,
    isAdmin: boolean,
  ): Promise<PermissionResult> {
    const { action, playerId, userId, teamId } = context;

    switch (action) {
      case Action.VIEW:
        // Admins see all
        if (isAdmin) return { allowed: true };
        // Players see own payments
        if (userRole === RoleName.PLAYER) return { allowed: true };
        // Guardians see linked player payments
        if (playerId && userRole === RoleName.GUARDIAN) {
          const isGuardian = await this.isGuardianOfPlayer(
            userId,
            playerId,
            teamId,
          );
          return { allowed: isGuardian };
        }
        return { allowed: false };

      case Action.CREATE:
      case Action.DELETE:
        return { allowed: isAdmin }; // Only admins can create/delete payments

      case Action.PAY:
        // Players can pay own, guardians can pay for linked players
        if (userRole === RoleName.PLAYER) return { allowed: true };
        if (playerId && userRole === RoleName.GUARDIAN) {
          const isGuardian = await this.isGuardianOfPlayer(
            userId,
            playerId,
            teamId,
          );
          return { allowed: isGuardian };
        }
        return { allowed: false };

      case Action.REFUND:
        return { allowed: isAdmin };

      default:
        return { allowed: false };
    }
  }

  private async checkGuardianLinkPermission(
    context: PermissionContext,
    userRole: RoleName,
    isAdmin: boolean,
  ): Promise<PermissionResult> {
    const { action, targetUserId, userId } = context;

    switch (action) {
      case Action.VIEW:
        // Admins see all
        if (isAdmin) return { allowed: true };
        // Players and guardians see own links
        if (targetUserId === userId) return { allowed: true };
        return { allowed: false };

      case Action.CREATE:
        // Guardians and players can request links
        if (userRole === RoleName.GUARDIAN || userRole === RoleName.PLAYER) {
          return { allowed: true };
        }
        return { allowed: false };

      case Action.APPROVE:
        // Only the non-requesting side (guardian or player) can respond
        // Coaches/assistant coaches CANNOT approve/reject
        if (targetUserId === userId) {
          return { allowed: true };
        }
        return { allowed: false };

      case Action.DELETE:
        // Only the directly involved user can remove their own link
        // (e.g. guardian removing their link)
        if (targetUserId === userId) {
          return { allowed: true };
        }
        return { allowed: false };

      default:
        return { allowed: false };
    }
  }

  private checkPlayerPermission(
    context: PermissionContext,
    userRole: RoleName,
    isAdmin: boolean,
  ): PermissionResult {
    const { action } = context;

    switch (action) {
      case Action.VIEW:
        return { allowed: true }; // All team members can view roster

      case Action.CREATE:
      case Action.UPDATE:
      case Action.DELETE:
        return { allowed: isAdmin }; // Only admins can manage roster

      default:
        return { allowed: false };
    }
  }
}

export const permissionService = new PermissionService();
