import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';

export const updatePreferencesSchema: ValidationSchema = {
  body: Joi.object({
    notificationsEnabled: Joi.boolean().required().messages({
      'any.required': 'notificationsEnabled is required',
    }),
  }),
};
