import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';
import { EventType } from './event.interface';

const eventTypeValues = Object.values(EventType) as string[];
const recurrenceFrequencies = ['daily', 'weekly', 'monthly'] as const;

const recurrenceRuleSchema = Joi.object({
  frequency: Joi.string()
    .valid(...recurrenceFrequencies)
    .required()
    .messages({
      'any.only': 'frequency must be one of: daily, weekly, monthly'
    }),
  interval: Joi.number().integer().min(1).required(),
  endDate: Joi.date().iso().optional(),
  count: Joi.number().integer().min(1).optional()
}).messages({
  'object.min': 'Recurrence must have either endDate or count'
});

const baseEventBodySchema = {
  type: Joi.string()
    .valid(...eventTypeValues)
    .required()
    .messages({
      'any.only': `type must be one of: ${eventTypeValues.join(', ')}`
    }),
  title: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.empty': 'Title is required',
      'string.max': 'Title cannot exceed 200 characters'
    }),
  description: Joi.string().trim().max(2000).allow('', null).optional(),
  start: Joi.date().iso().optional().messages({
    'date.format': 'Start must be a valid ISO 8601 date'
  }),
  end: Joi.date().iso().allow(null).optional().messages({
    'date.format': 'End must be a valid ISO 8601 date'
  }),
  location: Joi.string().trim().max(200).allow('', null).optional(),
  recurrence: recurrenceRuleSchema.optional()
};

export const createEventSchema: ValidationSchema = {
  body: Joi.object({
    ...baseEventBodySchema
  })
};

export const updateEventSchema: ValidationSchema = {
  body: Joi.object({
    type: Joi.string().valid(...eventTypeValues).optional(),
    title: Joi.string().trim().min(1).max(200).optional(),
    description: Joi.string().trim().max(2000).allow('', null).optional(),
    start: Joi.date().iso().optional(),
    end: Joi.date().iso().allow(null).optional(),
    location: Joi.string().trim().max(200).allow('', null).optional(),
    recurrence: Joi.alternatives().try(recurrenceRuleSchema, Joi.valid(null)).optional()
  })
};

const eventListQuerySchema = {
  start: Joi.date().iso().optional().messages({
    'date.format': 'start must be a valid ISO 8601 date'
  }),
  end: Joi.date().iso().optional().messages({
    'date.format': 'end must be a valid ISO 8601 date'
  }),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  view: Joi.string().valid('month', 'week', 'day').optional().messages({
    'any.only': 'view must be one of: month, week, day'
  }),
  date: Joi.date().iso().optional().messages({
    'date.format': 'date must be a valid ISO 8601 date'
  })
};

export const getEventsByDateRangeSchema: ValidationSchema = {
  query: Joi.object({
    ...eventListQuerySchema
  })
};

export const getEventsBroadSchema: ValidationSchema = {
  query: Joi.object({
    teamIds: Joi.alternatives()
      .try(Joi.string(), Joi.array().items(Joi.string()))
      .optional(),
    ...eventListQuerySchema
  })
};
