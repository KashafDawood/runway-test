import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';

export const signUpValidation: ValidationSchema = {
  body: Joi.object().keys({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required',
    }),
    name: Joi.string().required().trim().messages({
      'any.required': 'Name is required',
    }),
    teamName: Joi.string().optional().trim().messages({
      'string.base': 'Team name must be a string',
    }),
    sport: Joi.string().optional().trim().messages({
      'string.base': 'Sport must be a string',
    }),
    season: Joi.string().optional().trim().messages({
      'string.base': 'Season must be a string',
    }),
  }),
};

export const signInValidation: ValidationSchema = {
  body: Joi.object().keys({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  }),
};

export const verifyEmailValidation: ValidationSchema = {
  body: Joi.object().keys({
    code: Joi.string().pattern(/^\d{6}$/).required().messages({
      'string.pattern.base': 'Verification code must be exactly 6 digits',
      'any.required': 'Verification code is required',
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  }),
};

export const forgotPasswordValidation: ValidationSchema = {
  body: Joi.object().keys({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  }),
};

export const resetPasswordValidation: ValidationSchema = {
  body: Joi.object().keys({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required',
    }),
    newPassword: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'New password is required',
    }),
  }),
};

export const resendVerificationValidation: ValidationSchema = {
  body: Joi.object().keys({
    email: Joi.string().email().optional().messages({
      'string.email': 'Please provide a valid email address',
    }),
  }),
};

export const setActiveTeamValidation: ValidationSchema = {
  body: Joi.object().keys({
    teamId: Joi.string().required().messages({
      'any.required': 'Team ID is required',
      'string.base': 'Team ID must be a string',
    }),
  }),
};
