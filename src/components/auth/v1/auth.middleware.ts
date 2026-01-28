import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import asyncWrapper from "@core/utils/asyncWrapper";
import AppError from "@core/utils/appError";
import { verifyAccessToken } from "@shared/services/jwt";
import UserModel from "@components/user/v1/user.model";
import { UserRole } from "@components/userRole/v1/userRole.model";
import { RoleName } from "@components/role/v1/role.interface";
import { UserRoleStatus } from "@components/userRole/v1/userRole.interface";

export const verifyToken = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Access token is required");
    }

    const token = authHeader.split("Bearer ")[1];

    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Access token is required");
    }

    // Verify token
    const decoded = await verifyAccessToken(token);

    // Get user from database
    const user = await UserModel.findById(decoded._id);

    if (!user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "User not found");
    }

    // Attach user to request
    req.user = user;

    next();
  },
);

export const requireEmailVerified = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required");
    }

    if (!req.user.email_verified) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Email verification required. Please verify your email to access this resource.",
      );
    }

    next();
  },
);

/**
 * Extract team context from request params or query
 * Middleware to ensure teamId is available
 */
export const extractTeamContext = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    let teamId = req.params.teamId || req.query.teamId || req.body.teamId;

    // if teamid is not provided in the requrest fallback to active team id
    if (!teamId && req.user){
      // reload the user to get the latest active team id
      const user = await UserModel.findById(req.user._id);
      if (user?.activeTeamId) {
        teamId = user.activeTeamId.toString();
      }
    }

    if (!teamId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Team context is required. Please provide teamId in params, query, or body.",
      );
    }

    // Attach teamId to request for easy access
    (req as any).teamId = teamId as string;

    next();
  },
);

/**
 * Use active team context if no teamId provided in request
 * Optional middleware that sets teamId from user's activeTeamId
 * Does not throw error if activeTeamId is not set (unlike extractTeamContext)
 */
export const useActiveTeamContext = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    // only set if team id not already in request
    if (!(req as any).teamId && req.user ) {
      const user = await UserModel.findById(req.user._id).select('activeTeamId');
      if (user?.activeTeamId) {
        (req as any).teamId = user.activeTeamId.toString();
      }
    }
    next();
  },
)

/**
 * Require that user has an active team set
 * Throws error if user has no activeTeamId
 */
export const requireActiveTeam = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required");
    }

    // Reload user to get latest activeTeamId
    const user = await UserModel.findById(req.user._id).select('activeTeamId');
    
    if (!user?.activeTeamId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "No active team set. Please set an active team first.",
      );
    }

    // Set teamId from active team if not already set
    if (!(req as any).teamId) {
      (req as any).teamId = String(user.activeTeamId);
    }

    next();
  },
);

/**
 * Check if user has specific role in team context
 * Requires extractTeamContext middleware to be run first
 */
export const requireTeamRole = (...allowedRoles: RoleName[]) => {
  return asyncWrapper(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required");
      }

      if (!(req as any).teamId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Team context is required. Use extractTeamContext middleware first.",
        );
      }

      // Get user's role in this team
      const userRole = await UserRole.findOne({
        userId: req.user._id,
        teamId: (req as any).teamId,
        status: UserRoleStatus.ACTIVE,
      });

      if (!userRole) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You are not a member of this team",
        );
      }

      if (!allowedRoles.includes(userRole.roleName)) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `Access denied. Required role: ${allowedRoles.join(" or ")}`,
        );
      }

      // Attach user's role in team to request
      (req as any).userTeamRole = userRole.roleName;

      next();
    },
  );
};

/**
 * Check if user is admin (coach or assistant coach) in team
 */
export const requireTeamAdmin = requireTeamRole(
  RoleName.COACH,
  RoleName.ASSISTANT_COACH,
);

/**
 * Check if user is a member of team (any role)
 */
export const requireTeamMember = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required");
    }

    if (!(req as any).teamId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Team context is required. Use extractTeamContext middleware first.",
      );
    }

    // Check if user has any active role in team
    const userRole = await UserRole.findOne({
      userId: req.user._id,
      teamId: (req as any).teamId,
      status: UserRoleStatus.ACTIVE,
    });

    if (!userRole) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not a member of this team",
      );
    }

    // Attach user's role to request
    (req as any).userTeamRole = userRole.roleName;

    next();
  },
);
