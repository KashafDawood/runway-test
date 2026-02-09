import nodemailer from 'nodemailer';
import Email from 'email-templates';
import path from 'path';
import config from '@config/config';
import logger from '@core/utils/logger';

const transport = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.port === 465,
  auth: config.mail.user && config.mail.pass ? {
    user: config.mail.user,
    pass: config.mail.pass,
  } : undefined,
});

const emailClient = new Email({
  message: {
    from: config.mail.from,
  },
  send: config.app.isProd || config.app.isStaging,
  preview: config.app.isDev,
  transport,
  views: {
    root: path.join(__dirname, '../../../emails'),
    options: {
      extension: 'pug',
    },
  },
  juice: true,
  juiceResources: {
    preserveImportant: true,
    webResources: {
      relativeTo: path.join(__dirname, '../../../emails'),
    },
  },
});

export const sendEmail = async (template: string, to: string | string[], locals: Record<string, unknown>): Promise<void> => {
  try {
    const recipients = Array.isArray(to) ? to : [to];
    
    await emailClient.send({
      template,
      message: {
        to: recipients,
      },
      locals,
    });
    
    logger.info(`Email sent successfully: ${template} to ${recipients.join(', ')}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending email: ${template}`, errorMessage);
    throw error;
  }
};

export default { sendEmail };
