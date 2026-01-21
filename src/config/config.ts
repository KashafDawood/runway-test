import Joi from 'joi';
import * as dotenv from 'dotenv';

dotenv.config();

// All env variables used by the app should be defined in this file.

// To define new env:
// 1. Add env variable to .env file;
// 2. Provide validation rules for your env in envsSchema;
// 3. Make it visible outside of this module in export section;
// 4. Access your env variable only via config file.
// Do not use process.env object outside of this file.

const envsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'test', 'development', 'staging').required().default('development'),
    HOST: Joi.string().required(),
    PORT: Joi.number().default(8000),
    APP_NAME: Joi.string(),
    FRONT_END_URL: Joi.string(),
    MONGO_URI: Joi.string(),
    ORIGIN_REGEX: Joi.string().default('^http://localhost:.*'),
    ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  })
  .unknown(true);

const { value: envVars, error } = envsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);
if (error) {
  throw new Error(
    `Config validation error: ${error.message}. \n
     This app requires env variables to work properly.`,
  );
}

// map env vars and make it visible outside module
export default {
  app: {
    env: envVars.NODE_ENV,
    host: envVars.HOST,
    port: envVars.PORT,
    name: envVars.APP_NAME,
    isDev: envVars.NODE_ENV === 'development',
    isProd: envVars.NODE_ENV === 'production',
    isStaging: envVars.NODE_ENV === 'staging',
    originRegex: envVars.ORIGIN_REGEX,
    allowedOrigins: envVars.ALLOWED_ORIGINS,
    frontEndUrl: envVars.FRONT_END_URL || 'http://localhost:3000',
  },
  db: {
    mongo_uri: envVars.MONGO_URI,
  },
};
