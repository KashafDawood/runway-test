import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';
import { SystemEventKind } from './teamChat.interface';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './teamChat.service';

const systemEventKindValues = Object.values(SystemEventKind) as string[];

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

/**
 * Stub endpoint: POST /teams/:teamId/chat/system-messages (admin only)
 */
export const postSystemMessageSchema: ValidationSchema = {
  body: Joi.object({
    eventKind: Joi.string()
      .valid(...systemEventKindValues)
      .required()
      .messages({
        'any.only': `eventKind must be one of: ${systemEventKindValues.join(', ')}`
      }),
    payload: Joi.object().unknown(true).optional()
  })
};

