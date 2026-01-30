import Joi from 'joi';
import { ValidationSchema } from '@core/middlewares/validate.middleware';
import { AttendanceStatus } from './attendance.interface';

const attendanceStatusValues: AttendanceStatus[] = ['present', 'absent'];

export const putAttendanceSchema: ValidationSchema = {
  body: Joi.object({
    playerId: Joi.string().required().messages({
      'any.required': 'playerId is required'
    }),
    status: Joi.string()
      .valid(...attendanceStatusValues)
      .required()
      .messages({
        'any.only': `status must be one of: ${attendanceStatusValues.join(', ')}`
      })
  })
};

export const getAttendanceParticipantsQuerySchema: ValidationSchema = {
  query: Joi.object({
    search: Joi.string().trim().allow('').optional()
  })
};

export const getAttendanceQuerySchema: ValidationSchema = {
  query: Joi.object({
    playerId: Joi.string().optional()
  })
};
