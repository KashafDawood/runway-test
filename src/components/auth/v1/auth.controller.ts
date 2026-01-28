import { Request, Response } from 'express';
import httpStatus from 'http-status';
import asyncWrapper from '@core/utils/asyncWrapper';
import AppError from '@core/utils/appError';
import * as authService from './auth.service';
import logger from '@core/utils/logger';

export const signUp = asyncWrapper(async (req: Request, res: Response) => {
  const { email, password, name, teamName, sport, season } = req.body;

  const result = await authService.signUp({ email, password, name, teamName, sport, season });

  logger.info(`User signed up successfully: ${email}`);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: 'User registered successfully. Please check your email to verify your account.',
    data: result,
  });
});

export const signIn = asyncWrapper(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await authService.signIn(email, password);

  logger.info(`User signed in successfully: ${email}`);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Signed in successfully',
    data: result,
  });
});

export const verifyEmail = asyncWrapper(async (req: Request, res: Response) => {
  const { token } = req.body;

  const result = await authService.verifyEmail(token);

  logger.info(`Email verified successfully for user: ${result.user.email}`);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Email verified successfully',
    data: result,
  });
});

export const resendVerificationEmail = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  await authService.resendVerificationEmail(userId);

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
