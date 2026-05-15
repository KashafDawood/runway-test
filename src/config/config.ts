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
    JWT_EXPIRES_IN: Joi.string().default('30d'),
    // Mail Configuration
    ADMIN_EMAIL: Joi.string().email(),
    MAIL_HOST: Joi.string().default('smtp.resend.com'),
    MAIL_PORT: Joi.number().default(465),
    MAIL_USER: Joi.string(),
    MAIL_PASS: Joi.string(),
    MAIL_FROM: Joi.string().default('noreply@runway.team'),
    // Auth Service Configuration (for future migration)
    USE_EXTERNAL_AUTH: Joi.string().valid('true', 'false').default('false'),
    AUTH_SERVICE_URL: Joi.string().default('http://localhost:8000'),
    // Firebase Cloud Messaging (optional – app runs without push if not set)
    FIREBASE_PROJECT_ID: Joi.string().optional(),
    FIREBASE_CLIENT_EMAIL: Joi.string().email().optional(),
    FIREBASE_PRIVATE_KEY: Joi.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_PATH: Joi.string().optional(),
    FIREBASE_STORAGE_BUCKET: Joi.string().optional(),
    STORAGE_DRIVER: Joi.string().valid('disk', 'firebase').default('disk'),
    // Event reminder job (optional)
    EVENT_REMINDER_MINUTES_BEFORE: Joi.number().optional().default(60),
    EVENT_REMINDER_CRON: Joi.string().optional().default('*/15 * * * *'),
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
  auth: {
    useExternalService: envVars.USE_EXTERNAL_AUTH === 'true',
    externalServiceUrl: envVars.AUTH_SERVICE_URL,
  },
  firebase: {
    projectId: envVars.FIREBASE_PROJECT_ID,
    clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
    privateKey: envVars.FIREBASE_PRIVATE_KEY,
    serviceAccountPath: envVars.FIREBASE_SERVICE_ACCOUNT_PATH,
    storageBucket: envVars.FIREBASE_STORAGE_BUCKET,
  },
  storage: {
    driver: envVars.STORAGE_DRIVER as 'disk' | 'firebase',
  },
  eventReminder: {
    minutesBefore: envVars.EVENT_REMINDER_MINUTES_BEFORE,
    cronSchedule: envVars.EVENT_REMINDER_CRON,
  },
};
