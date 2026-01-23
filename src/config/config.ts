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
    // JWT Configuration
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().default('24h'),
    // Mail Configuration
    ADMIN_EMAIL: Joi.string().email(),
    MAIL_HOST: Joi.string().default('smtp.resend.com'),
    MAIL_PORT: Joi.number().default(465),
    MAIL_USER: Joi.string(),
    MAIL_PASS: Joi.string(),
    MAIL_FROM: Joi.string().default('noreply@runway.team'),
    // Redis Configuration
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().optional(),
    // Auth Service Configuration (for future migration)
    USE_EXTERNAL_AUTH: Joi.string().valid('true', 'false').default('false'),
    AUTH_SERVICE_URL: Joi.string().default('http://localhost:8000'),
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
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
  },
  mail: {
    host: envVars.MAIL_HOST,
    port: envVars.MAIL_PORT,
    user: envVars.MAIL_USER,
    pass: envVars.MAIL_PASS,
    from: envVars.MAIL_FROM,
    adminEmail: envVars.ADMIN_EMAIL || 'admin@runway.team',
  },
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
  },
  auth: {
    useExternalService: envVars.USE_EXTERNAL_AUTH === 'true',
    externalServiceUrl: envVars.AUTH_SERVICE_URL,
  },
};
