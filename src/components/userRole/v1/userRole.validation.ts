import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';
import { RoleName } from '@components/role/v1/role.interface';

// Common param validation for both endpoints
const commonParamsSchema = Joi.object({
  teamId: Joi.string()
    .required()
    .messages({
      'string.empty': 'Team ID is required',
      'any.required': 'Team ID is required',
    }),
  userId: Joi.string()
    .required()
    .messages({
      'string.empty': 'User ID is required',
      'any.required': 'User ID is required',
    }),
});

export const updateRoleSchema: ValidationSchema = {
  params: commonParamsSchema,
  body: Joi.object({
    role: Joi.string()
      .valid(...Object.values(RoleName))
      .required()
      .messages({
        'any.only': `Role must be one of: ${Object.values(RoleName).join(', ')}`,
        'any.required': 'Role is required',
      }),
  }),
};

export const getUserRoleSchema: ValidationSchema = {
  params: commonParamsSchema,
};
