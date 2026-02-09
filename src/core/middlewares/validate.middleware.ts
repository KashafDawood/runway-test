import Joi from 'joi';
import httpStatus from 'http-status';
import { NextFunction, Request, Response } from 'express';
import AppError from '@core/utils/appError';

export interface ValidationSchema {
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  body?: Joi.ObjectSchema;
}

const validate = (schema: ValidationSchema) => (req: Request, res: Response, next: NextFunction) => {
  const pickObjectKeysWithValue = (object: Record<string, unknown>, keys: string[]) =>
    keys.reduce((o: Record<string, unknown>, k: string) => {
      o[k] = object[k];
      return o;
    }, {});

  const definedSchemaKeys = Object.keys(schema);
  const acceptableSchemaKeys: string[] = ['params', 'query', 'body'];
  const filterOutNotValidSchemaKeys: string[] = Object.keys(schema).filter((k) => acceptableSchemaKeys.includes(k));

  if (filterOutNotValidSchemaKeys.length !== definedSchemaKeys.length) {
    const e = `Wrongly defined validation Schema keys: [${definedSchemaKeys}], allowed keys: [${acceptableSchemaKeys}]`;
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, e, false);
  }

  const validSchema = pickObjectKeysWithValue(schema as Record<string, unknown>, filterOutNotValidSchemaKeys);
  const reqData: Record<string, unknown> = {
    params: req.params,
    query: req.query,
    body: req.body,
  };
  const object = pickObjectKeysWithValue(reqData, Object.keys(validSchema));

  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: 'key' } })
    .validate(object);

  if (error) {
    const errorMessage = error.details.map((details) => details.message).join(', ');
    return next(new AppError(httpStatus.BAD_REQUEST, errorMessage));
  }

  Object.assign(req, value);
  return next();
};

export default validate;
