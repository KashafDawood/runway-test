import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import logger from '@core/utils/logger';
import { verifyAccessToken } from '@shared/services/jwt';
import UserModel from '@components/user/v1/user.model';
import { UserRole } from '@components/userRole/v1/userRole.model';
import { UserRoleStatus } from '@components/userRole/v1/userRole.interface';
import { createUserMessage, createSystemMessage } from './teamChat.service';
import { IUser } from '@components/user/v1/user.interface';
import { permissionService } from '@shared/services/permission.service';
import { Action, Resource } from '@shared/types/permission.types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: IUser;
  teamId?: string;
}

interface SocketAuthData {
  token: string;
  teamId: string;
}

// Singleton instance (set after initialization in server.ts)
let gatewayInstance: TeamChatGateway | null = null;

/**
 * Get the gateway instance (for use in service layer)
 */
export const getTeamChatGateway = (): TeamChatGateway | null => {
  return gatewayInstance;
};

/**
 * Socket.IO Gateway for Team Chat
 * Handles real-time messaging via WebSocket connections
 */
export class TeamChatGateway {
  private io: SocketIOServer;
  private sessionNamespace;

  constructor(httpServer: HTTPServer) {
    // Set singleton instance
    gatewayInstance = this as TeamChatGateway;
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/socket.io'
    });
    this.sessionNamespace = this.io.of('/session');

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup authentication middleware for Socket.IO connections
   */
  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const { token, teamId } = socket.handshake.auth as SocketAuthData;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        if (!teamId) {
          return next(new Error('Team ID required'));
        }

        // Verify JWT token
        const decoded = await verifyAccessToken(token);
        const user = await UserModel.findById(decoded._id);

        if (!user) {
          return next(new Error('User not found'));
        }

        // Verify user is a member of the team
        const userRole = await UserRole.findOne({
          userId: user._id,
          teamId: teamId,
          status: UserRoleStatus.ACTIVE
        });

        if (!userRole) {
          return next(new Error('User is not a member of this team'));
        }

        const chatViewPerm = await permissionService.checkPermission({
          userId: String(user._id),
          teamId,
          resource: Resource.CHAT,
          action: Action.VIEW
        });
        if (!chatViewPerm.allowed) {
          return next(new Error(chatViewPerm.reason || 'Not allowed to access team chat'));
        }

        // Attach user info to socket
        socket.userId = String(user._id);
        socket.user = user;
        socket.teamId = teamId;

        next();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Socket.IO authentication error:', error);
        next(new Error(errorMessage || 'Authentication failed'));
      }
    });

    this.sessionNamespace.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const { token } = socket.handshake.auth as { token?: string };
        logger.info('Session namespace: incoming connection attempt', {
          hasToken: !!token,
          socketId: socket.id
        });

        if (!token) {
          logger.warn('Session namespace: no token provided');
          return next(new Error('Authentication token required'));
        }

        const decoded = await verifyAccessToken(token);
        logger.info('Session namespace: token verified', { userId: decoded._id });

        const user = await UserModel.findById(decoded._id);
        if (!user) {
          logger.warn('Session namespace: user not found', { userId: decoded._id });
          return next(new Error('User not found'));
        }

        socket.userId = String(user._id);
        socket.user = user;
        logger.info('Session namespace: authenticated', { userId: socket.userId });
        next();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Session namespace auth error:', error);
        next(new Error(errorMessage || 'Authentication failed'));
      }
    });
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const teamId = socket.teamId;
      const userId = socket.userId;

      if (!teamId || !userId) {
        socket.disconnect();
        return;
      }

      // Join team room
      const roomName = `team:${teamId}`;
      socket.join(roomName);

      logger.info(`User ${userId} joined team chat room: ${roomName}`);

      // Handle new message event
      socket.on('message:send', async (data: { text: string }) => {
        try {
          if (!data.text || !data.text.trim()) {
            socket.emit('error', { message: 'Message text is required' });
            return;
          }

          const perm = await permissionService.checkPermission({
            userId,
            teamId,
            resource: Resource.CHAT,
            action: Action.CREATE
          });
          if (!perm.allowed) {
            socket.emit('error', {
              message: perm.reason ?? 'Not allowed to send chat messages'
            });
            return;
          }

          // Create message via service
          const message = await createUserMessage({
            teamId,
            senderId: userId,
            text: data.text
          });

          // Broadcast to all clients in the team room (including sender)
          this.io.to(roomName).emit('message:new', message);

          logger.info(`Message sent by ${userId} in team ${teamId}`);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Error sending message:', error);
          socket.emit('error', { message: errorMessage || 'Failed to send message' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`User ${userId} left team chat room: ${roomName}`);
      });

      // Send connection confirmation
      socket.emit('connected', {
        teamId,
        userId,
        message: 'Successfully connected to team chat'
      });
    });

    this.sessionNamespace.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId;
      logger.info('Session namespace: new connection', {
        socketId: socket.id,
        userId,
        handshake: socket.handshake
      });

      if (!userId) {
        logger.warn('Session namespace: connection without userId, disconnecting');
        socket.disconnect();
        return;
      }

      const roomName = `user:${userId}`;
      socket.join(roomName);
      logger.info(`User ${userId} joined session room: ${roomName}`);

      socket.emit('connected', {
        userId,
        message: 'Successfully connected to session updates'
      });

      socket.on('disconnect', (reason) => {
        logger.info(`User ${userId} left session room: ${roomName}, reason: ${reason}`);
      });
    });
  }

  /**
   * Emit a new message to all clients in a team room
   * Called from service layer when messages are created via REST API
   */
  public emitNewMessage(teamId: string, message: Record<string, unknown>) {
    const roomName = `team:${teamId}`;
    this.io.to(roomName).emit('message:new', message);
    logger.info(`Broadcasted message to team room: ${roomName}`);
  }

  /**
   * Emit chat message notification to all team members via session namespace (real-time)
   */
  public async emitChatMessageNotification(teamId: string, message: Record<string, unknown>, excludeUserId?: string) {
    const { UserRole } = await import('@components/userRole/v1/userRole.model');
    const { UserRoleStatus } = await import('@components/userRole/v1/userRole.interface');

    const query: Record<string, unknown> = {
      teamId: new (await import('mongoose')).Types.ObjectId(teamId),
      status: UserRoleStatus.ACTIVE,
    };
    if (excludeUserId) {
      query.userId = { $ne: new (await import('mongoose')).Types.ObjectId(excludeUserId) };
    }

    const roles = await UserRole.find(query).select('userId').lean();

    for (const role of roles) {
      const userId = role.userId.toString();
      const roomName = `user:${userId}`;
      this.sessionNamespace.to(roomName).emit('chat:message', {
        ...message,
        notificationType: 'chat_message'
      });
    }
    logger.info(`Broadcasted chat message notification to ${roles.length} users via session namespace`);
  }

  /**
   * Emit a system message to all clients in a team room
   */
  public async emitSystemMessage(teamId: string, text: string, meta?: Record<string, unknown>) {
    try {
      const message = await createSystemMessage({
        teamId,
        text,
        meta
      });

      const roomName = `team:${teamId}`;
      this.io.to(roomName).emit('message:new', message);
      logger.info(`Broadcasted system message to team room: ${roomName}`);
    } catch (error: unknown) {
      logger.error('Error creating system message:', error);
    }
  }

  /**
   * Get the Socket.IO server instance (for advanced usage)
   */
  public getIO(): SocketIOServer {
    return this.io;
  }

  public emitMembershipApproved(userId: string, payload: Record<string, unknown>) {
    const roomName = `user:${userId}`;
    this.sessionNamespace.to(roomName).emit('membership:approved', payload);
    logger.info(`Broadcasted membership approval to session room: ${roomName}`);
  }

  /**
   * Emit event created notification to all team members via session namespace
   */
  public async emitEventCreated(teamId: string, payload: Record<string, unknown>, excludeUserId?: string) {
    const { UserRole } = await import('@components/userRole/v1/userRole.model');
    const { UserRoleStatus } = await import('@components/userRole/v1/userRole.interface');

    const query: Record<string, unknown> = {
      teamId: new (await import('mongoose')).Types.ObjectId(teamId),
      status: UserRoleStatus.ACTIVE,
    };
    if (excludeUserId) {
      query.userId = { $ne: new (await import('mongoose')).Types.ObjectId(excludeUserId) };
    }

    const roles = await UserRole.find(query).select('userId').lean();

    for (const role of roles) {
      const userId = role.userId.toString();
      const roomName = `user:${userId}`;
      this.sessionNamespace.to(roomName).emit('event:created', payload);
    }
    logger.info(`Broadcasted event created to ${roles.length} users via session namespace`);
  }

  /**
   * Emit event updated notification to all team members via session namespace
   */
  public async emitEventUpdated(teamId: string, payload: Record<string, unknown>, excludeUserId?: string) {
    const { UserRole } = await import('@components/userRole/v1/userRole.model');
    const { UserRoleStatus } = await import('@components/userRole/v1/userRole.interface');

    const query: Record<string, unknown> = {
      teamId: new (await import('mongoose')).Types.ObjectId(teamId),
      status: UserRoleStatus.ACTIVE,
    };
    if (excludeUserId) {
      query.userId = { $ne: new (await import('mongoose')).Types.ObjectId(excludeUserId) };
    }

    const roles = await UserRole.find(query).select('userId').lean();

    for (const role of roles) {
      const userId = role.userId.toString();
      const roomName = `user:${userId}`;
      this.sessionNamespace.to(roomName).emit('event:updated', payload);
    }
    logger.info(`Broadcasted event updated to ${roles.length} users via session namespace`);
  }

  /**
   * Emit event deleted notification to all team members via session namespace
   */
  public async emitEventDeleted(teamId: string, payload: Record<string, unknown>, excludeUserId?: string) {
    const { UserRole } = await import('@components/userRole/v1/userRole.model');
    const { UserRoleStatus } = await import('@components/userRole/v1/userRole.interface');

    const query: Record<string, unknown> = {
      teamId: new (await import('mongoose')).Types.ObjectId(teamId),
      status: UserRoleStatus.ACTIVE,
    };
    if (excludeUserId) {
      query.userId = { $ne: new (await import('mongoose')).Types.ObjectId(excludeUserId) };
    }

    const roles = await UserRole.find(query).select('userId').lean();

    for (const role of roles) {
      const userId = role.userId.toString();
      const roomName = `user:${userId}`;
      this.sessionNamespace.to(roomName).emit('event:deleted', payload);
    }
    logger.info(`Broadcasted event deleted to ${roles.length} users via session namespace`);
  }

  /**
   * Emit event reminder notification to specific users
   */
  public emitEventReminder(userId: string, payload: Record<string, unknown>) {
    const roomName = `user:${userId}`;
    this.sessionNamespace.to(roomName).emit('event:reminder', payload);
    logger.info(`Broadcasted event reminder to user room: ${roomName}`);
  }
}
