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
      }),
    userData: Joi.object({
      name: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .optional()
        .messages({
          'string.min': 'Name must be at least 2 characters',
          'string.max': 'Name cannot exceed 100 characters'
        }),
      password: Joi.string()
        .min(8)
        .optional()
        .messages({
          'string.min': 'Password must be at least 8 characters'
        }),
      phone: Joi.string()
        .trim()
        .max(20)
        .optional()
        .messages({
          'string.max': 'Phone cannot exceed 20 characters'
        })
    })
      .optional()
      .messages({
        'object.base': 'userData must be an object'
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

export const getUserInvitesSchema: ValidationSchema = {
  query: Joi.object({
    status: Joi.string()
      .valid('pending', 'pending_approval', 'accepted', 'declined', 'expired', 'cancelled')
      .optional()
      .messages({
        'any.only': 'Status must be one of: pending, pending_approval, accepted, declined, expired, cancelled'
      })
  })
};

export const approvePendingInviteSchema: ValidationSchema = {
  params: Joi.object({
    inviteId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Invite ID is required'
      })
  }),
  body: Joi.object({
    role: Joi.string()
      .valid(...Object.values(RoleName))
      .required()
      .messages({
        'any.only': `Role must be one of: ${Object.values(RoleName).join(', ')}`,
        'any.required': 'Role is required'
      })
  })
};