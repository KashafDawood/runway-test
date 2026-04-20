import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';

export const requestGuardianLinkSchema: ValidationSchema = {
  body: Joi.object({
    playerId: Joi.string().trim().required().messages({
      'any.required': 'playerId is required'
    }),
    guardianId: Joi.string().trim().required().messages({
      'any.required': 'guardianId is required'
    })
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
