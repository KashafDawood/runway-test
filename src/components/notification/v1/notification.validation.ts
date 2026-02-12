import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';

export const registerTokenSchema: ValidationSchema = {
  body: Joi.object({
    token: Joi.string().required().trim().min(1).messages({
      'string.empty': 'FCM token is required',
    }),
    platform: Joi.string().valid('android', 'ios', 'web').optional().default('web'),
    label: Joi.string().trim().max(100).optional(),
  }),
};

export const unregisterTokenSchema: ValidationSchema = {
  body: Joi.object({
    token: Joi.string().required().trim().min(1).messages({
      'string.empty': 'FCM token is required',
    }),
  }),
};
