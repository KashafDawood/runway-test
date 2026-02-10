import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';

export const requestGuardianLinkSchema: ValidationSchema = {
  body: Joi.object({
    // When requester is a GUARDIAN:
    //   - playerId is required
    //   - guardianId is ignored (always taken from auth user)
    //
    // When requester is a PLAYER:
    //   - guardianId is required
    //   - playerId is optional and will default to the player's own record
    playerId: Joi.string().trim().optional(),
    guardianId: Joi.string()
      .trim()
      .optional()
  })
};

export const guardianLinkParamsSchema: ValidationSchema = {
  params: Joi.object({
    teamId: Joi.string()
      .required()
      .messages({
        'string.empty': 'teamId is required'
      }),
    linkId: Joi.string()
      .required()
      .messages({
        'string.empty': 'linkId is required'
      })
  })
};

