import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';
import { RoleName } from '@components/role/v1/role.interface';
const INVITE_ACCEPT_ALLOWED_ROLES = Object.values(RoleName).filter(
  (role) => role !== RoleName.COACH
);

const inviteEntrySchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Each email must be valid',
    'any.required': 'Email is required'
  }),
  minorPlayerId: Joi.string().trim().optional()
});

export const createBatchInviteSchema: ValidationSchema = {
  body: Joi.object({
    emails: Joi.array().items(Joi.string().email()).max(20).optional(),
    inviteEntries: Joi.array().items(inviteEntrySchema).max(20).optional()
  })
    .or('emails', 'inviteEntries')
    .messages({
      'object.missing': 'Either emails or inviteEntries is required'
    })
};

export const checkInviteSchema: ValidationSchema = {
  query: Joi.object({
    token: Joi.string().length(64).optional().messages({
      'string.length': 'Invalid token format'
    }),
    inviteCode: Joi.string().trim().uppercase().alphanum().length(8).optional().messages({
      'string.length': 'Invite code must be 8 characters',
      'string.alphanum': 'Invite code must be alphanumeric'
    })
  }).or('token', 'inviteCode').messages({
    'object.missing': 'Token or invite code is required'
  })
};

export const acceptInviteSchema: ValidationSchema = {
  body: Joi.object({
    token: Joi.string().length(64).optional().messages({
      'string.length': 'Invalid token format'
    }),
    inviteCode: Joi.string().trim().uppercase().alphanum().length(8).optional().messages({
      'string.length': 'Invite code must be 8 characters',
      'string.alphanum': 'Invite code must be alphanumeric'
    }),
    role: Joi.string().valid(...INVITE_ACCEPT_ALLOWED_ROLES).required().messages({
      'any.only': `Role must be one of: ${INVITE_ACCEPT_ALLOWED_ROLES.join(', ')}`,
      'any.required': 'Role is required'
    }),
    dateOfBirth: Joi.date().iso().optional().messages({
      'date.format': 'dateOfBirth must be an ISO date string'
    })
  }).or('token', 'inviteCode').messages({
    'object.missing': 'Token or invite code is required'
  })
};

export const getInviteByTokenSchema: ValidationSchema = {
  query: Joi.object({
    token: Joi.string().required().length(64).messages({
      'string.empty': 'Token is required'
    })
  })
};

export const cancelInviteSchema: ValidationSchema = {
  params: Joi.object({
    inviteId: Joi.string().required().messages({
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
    inviteId: Joi.string().required().messages({
      'string.empty': 'Invite ID is required'
    })
  }),
  body: Joi.object({
    role: Joi.string().valid(...INVITE_ACCEPT_ALLOWED_ROLES).required().messages({
      'any.only': `Role must be one of: ${INVITE_ACCEPT_ALLOWED_ROLES.join(', ')}`,
      'any.required': 'Role is required'
    })
  })
};
