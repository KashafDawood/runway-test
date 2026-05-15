import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';

export const createTeamSchema: ValidationSchema = {
  body: Joi.object({
  name: Joi.string()
    .required()
    .trim()
    .min(2)
    .max(100)
    .messages({
      'string.empty': 'Team name is required',
      'string.min': 'Team name must be at least 2 characters',
      'string.max': 'Team name cannot exceed 100 characters'
    }),
  
  sport: Joi.string()
    .optional()
    .trim()
    .max(50)
    .messages({
      'string.max': 'Sport cannot exceed 50 characters'
    }),
  
  season: Joi.string()
    .optional()
    .trim()
    .max(50)
    .messages({
      'string.max': 'Season cannot exceed 50 characters'
    }),
  
  color: Joi.string()
    .optional()
    .trim()
    .max(20)
    .messages({
      'string.max': 'Color cannot exceed 20 characters'
    }),

  logoPath: Joi.string().optional().trim().max(2048),
  coverImagePath: Joi.string().optional().trim().max(2048),
  
  settings: Joi.object({
    allowPlayerInvites: Joi.boolean().optional(),
    requireGuardianApproval: Joi.boolean().optional()
  }).optional()
  })
};

export const updateTeamSchema: ValidationSchema = {
  body: Joi.object({
  name: Joi.string()
    .optional()
    .trim()
    .min(2)
    .max(100),
  
  sport: Joi.string()
    .optional()
    .trim()
    .max(50),
  
  season: Joi.string()
    .optional()
    .trim()
    .max(50),
  
  color: Joi.string()
    .optional()
    .trim()
    .max(20),

  logoPath: Joi.string().optional().trim().max(2048),
  coverImagePath: Joi.string().optional().trim().max(2048),
  
  settings: Joi.object({
    allowPlayerInvites: Joi.boolean().optional(),
    requireGuardianApproval: Joi.boolean().optional()
  }).optional()
  })
};

export const getTeamSchema: ValidationSchema = {
  params: Joi.object({
    teamId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Team ID is required'
      })
  })
};

export const addTeamMemberSchema: ValidationSchema = {
  body: Joi.object({
    memberId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Member ID is required'
      }),
    role: Joi.string()
      .optional()
      .valid('coach', 'assistant_coach', 'player', 'guardian', 'media')
      .messages({
        'any.only': 'Role must be one of: coach, assistant_coach, player, guardian, media'
      })
  })
};