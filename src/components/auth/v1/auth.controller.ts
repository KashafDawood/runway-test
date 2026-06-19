import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import * as authService from './auth.service';
import logger from '@core/utils/logger';
import { getClientPlatform, getDeviceLabel, isNativePlatform } from '@core/utils/clientPlatform';
import { attachRefreshCookieData } from './authToken.helper';
import { setRefreshCookie, clearRefreshCookie, getCookie } from '@core/utils/cookie.util';
import config from '@config/config';

function sendAuthResponse(
  req: Request,
  res: Response,
  statusCode: number,
  message: string,
  result: Awaited<ReturnType<typeof authService.signIn>>,
) {
  const platform = getClientPlatform(req);
  const { data, refreshRawToken } = attachRefreshCookieData(result);

  if (config.auth.v2Enabled && refreshRawToken && !isNativePlatform(platform)) {
    setRefreshCookie(res, refreshRawToken);
  }

  if (config.auth.v2Enabled && isNativePlatform(platform) && data.refreshToken) {
    // refreshToken already included in body for native clients
  } else if (!isNativePlatform(platform)) {
    delete data.refreshToken;
  }

  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function getRefreshTokenFromRequest(req: Request): string | undefined {
  const platform = getClientPlatform(req);

  if (isNativePlatform(platform) && config.auth.refreshTokenBodyEnabled) {
    const bodyToken = req.body?.refreshToken;
    if (typeof bodyToken === 'string' && bodyToken.length > 0) {
      return bodyToken;
    }
  }

  return getCookie(req, config.auth.refreshCookie.name);
}

export const signUp = asyncWrapper(async (req: Request, res: Response) => {
  const { email, password, name, dateOfBirth, skipEmailVerification } = req.body;

  const result = await authService.signUp({
    email,
    password,
    name,
    dateOfBirth,
    skipEmailVerification,
    platform: getClientPlatform(req),
    deviceLabel: getDeviceLabel(req),
  });

  logger.info(`User signed up successfully: ${email}`);

  sendAuthResponse(
    req,
    res,
    httpStatus.CREATED,
    skipEmailVerification
      ? 'User registered successfully.'
      : 'User registered successfully. Please check your email to verify your account.',
    result,
  );
});

export const signIn = asyncWrapper(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await authService.signIn(email, password, {
    platform: getClientPlatform(req),
    deviceLabel: getDeviceLabel(req),
  });

  logger.info(`User signed in successfully: ${email}`);

  sendAuthResponse(req, res, httpStatus.OK, 'Signed in successfully', result);
});

export const verifyEmail = asyncWrapper(async (req: Request, res: Response) => {
  const { code, email } = req.body;

  const result = await authService.verifyEmail(code, email, {
    platform: getClientPlatform(req),
    deviceLabel: getDeviceLabel(req),
  });

  logger.info(`Email verified successfully for user: ${result.user.email}`);

  sendAuthResponse(req, res, httpStatus.OK, 'Email verified successfully', result);
});

export const refresh = asyncWrapper(async (req: Request, res: Response) => {
  const rawRefreshToken = getRefreshTokenFromRequest(req);

  if (!rawRefreshToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token is required');
  }

  const platform = getClientPlatform(req);
  const result = await authService.refreshAccessToken(rawRefreshToken, platform);

  sendAuthResponse(req, res, httpStatus.OK, 'Token refreshed successfully', result);
});

export const logout = asyncWrapper(async (req: Request, res: Response) => {
  const rawRefreshToken = getRefreshTokenFromRequest(req);

  await authService.logout(rawRefreshToken);
  clearRefreshCookie(res);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Logged out successfully',
  });
});

export const logoutAll = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  await authService.logoutAll(userId);
  clearRefreshCookie(res);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Logged out from all devices successfully',
  });
});

export const getSessions = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const sessions = await authService.getSessions(userId);

  res.status(httpStatus.OK).json({
    success: true,
    data: sessions,
  });
});

export const upgradeSession = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const result = await authService.upgradeSession(userId, {
    platform: getClientPlatform(req),
    deviceLabel: getDeviceLabel(req),
  });

  logger.info(`Session upgraded for user: ${userId}`);

  sendAuthResponse(req, res, httpStatus.OK, 'Session upgraded successfully', result);
});

export const resendVerificationEmail = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { email } = req.body;

  // Allow resend via email (for unauthenticated users) or userId (for authenticated users)
  // If authenticated, prefer userId; otherwise require email
  if (userId) {
    await authService.resendVerificationEmail(userId);
  } else if (email) {
    await authService.resendVerificationEmail(undefined, email);
  } else {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email is required or authentication is required');
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Verification email sent successfully',
  });
});

export const forgotPassword = asyncWrapper(async (req: Request, res: Response) => {
  const { email } = req.body;

  const result = await authService.forgotPassword(email);

  // Always return success to prevent email enumeration
  res.status(httpStatus.OK).json({
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent',
    data: result,
  });
});

export const resetPassword = asyncWrapper(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  await authService.resetPassword(token, newPassword);

  logger.info('Password reset successfully');

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Password reset successfully. You can now sign in with your new password.',
  });
});

export const changePassword = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const { currentPassword, newPassword } = req.body;

  await authService.changePassword(userId, currentPassword, newPassword);
  clearRefreshCookie(res);

  logger.info(`Password changed for user: ${userId}`);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Password changed successfully',
  });
});

export const getMe = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const user = await authService.getUserProfile(userId);

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      email_verified: user.email_verified,
      avatar: user.avatar,
      dateOfBirth: user.dateOfBirth,
    },
  });
});

export const getActiveTeam = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const activeTeam = await authService.getActiveTeam(userId);

  res.status(httpStatus.OK).json({
    success: true,
    data: activeTeam,
  });
});

export const setActiveTeam = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { teamId } = req.body;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const activeTeam = await authService.setActiveTeam(userId, teamId);

  logger.info(`User ${userId} set active team to ${teamId}`);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Active team updated successfully',
    data: activeTeam,
  });
});
