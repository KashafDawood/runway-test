import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';
import { RsvpStatus } from './rsvp.interface';

const rsvpStatusValues: RsvpStatus[] = ['attending', 'not_attending'];

export const putRsvpSchema: ValidationSchema = {
  body: Joi.object({
    status: Joi.string()
      .valid(...rsvpStatusValues)
      .required()
      .messages({
        'any.only': `status must be one of: ${rsvpStatusValues.join(', ')}`
      }),
    playerId: Joi.string().optional()
  })
};

export const getRsvpQuerySchema: ValidationSchema = {
  query: Joi.object({
    playerId: Joi.string().optional()
  })
};
