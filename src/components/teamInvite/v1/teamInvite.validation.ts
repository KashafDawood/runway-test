import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';
import { RoleName } from '@components/role/v1/role.interface';

export const createBatchInviteSchema: ValidationSchema = {
  body: Joi.object({
    emails: Joi.array()
      .items(
        Joi.string().email().messages({
          'string.email': 'Each email must be valid'
        })
      )
      .min(1)
      .max(20)
      .required()
      .messages({
        'array.min': 'At least one email is required',
        'array.max': 'Maximum 20 emails allowed',
        'any.required': 'Emails array is required'
      })
  })
};

export const checkInviteSchema: ValidationSchema = {
  query: Joi.object({
    token: Joi.string()
      .required()
      .length(64)
      .messages({
        'string.empty': 'Token is required',
        'string.length': 'Invalid token format'
      })
  })
};

export const completeRegistrationSchema: ValidationSchema = {
  body: Joi.object({
    token: Joi.string()
      .required()
      .length(64)
      .messages({
        'string.empty': 'Token is required',
        'string.length': 'Invalid token format'
      }),
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters',
        'any.required': 'Name is required'
      }),
    password: Joi.string()
      .min(8)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters',
        'any.required': 'Password is required'
      }),
    phone: Joi.string()
      .trim()
      .max(20)
      .optional()
      .messages({
        'string.max': 'Phone cannot exceed 20 characters'
      })
  })
};

export const acceptInviteSchema: ValidationSchema = {
  body: Joi.object({
    token: Joi.string()
      .required()
      .length(64)
      .messages({
        'string.empty': 'Token is required',
        'string.length': 'Invalid token format'
      }),
    role: Joi.string()
      .valid(...Object.values(RoleName))
      .required()
      .messages({
        'any.only': `Role must be one of: ${Object.values(RoleName).join(', ')}`,
        'any.required': 'Role is required'
      })
  })
};

export const getInviteByTokenSchema: ValidationSchema = {
  query: Joi.object({
    token: Joi.string()
      .required()
      .length(64)
      .messages({
        'string.empty': 'Token is required'
      })
  })
};

export const cancelInviteSchema: ValidationSchema = {
  params: Joi.object({
    inviteId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Invite ID is required'
      })
  })
};