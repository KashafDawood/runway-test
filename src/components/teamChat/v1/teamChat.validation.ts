import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './teamChat.service';

export const createMessageSchema: ValidationSchema = {
  body: Joi.object({
    text: Joi.string()
      .trim()
      .min(1)
      .max(2000)
      .required()
      .messages({
        'string.empty': 'Message text is required',
        'string.min': 'Message must be at least 1 character',
        'string.max': 'Message cannot exceed 2000 characters'
      })
  })
};

export const getMessagesSchema: ValidationSchema = {
  query: Joi.object({
    limit: Joi.number()
      .integer()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .default(DEFAULT_PAGE_SIZE),
    before: Joi.date().iso().optional(),
    after: Joi.date().iso().optional()
  })
};

