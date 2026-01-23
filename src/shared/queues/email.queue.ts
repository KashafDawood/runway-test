import Queue from 'bull';
import config from '@config/config';
import logger from '@core/utils/logger';
import { sendEmail } from '@shared/services/mail';

interface IEmailJob {
  to: string;
  template: string;
  data: Record<string, any>;
}

// Create email queue
export const emailQueue = new Queue<IEmailJob>('email', {
  redis: {
    host: config.redis?.host || 'localhost',
    port: config.redis?.port || 6379,
    password: config.redis?.password
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

// Process email jobs
emailQueue.process(async (job) => {
  const { to, template, data } = job.data;

  try {
    logger.info(`Processing email job ${job.id}: sending ${template} to ${to}`);

    await sendEmail(template, to, data);

    logger.info(`Email job ${job.id} completed successfully`);

    return { success: true, email: to };
  } catch (error: any) {
    logger.error(`Email job ${job.id} failed: ${error.message}`, error);
    throw error; // Rethrow to trigger retry
  }
});

// Handle job completion
emailQueue.on('completed', (job) => {
  logger.debug(`Email job ${job.id} completed`);
});

// Handle job failure
emailQueue.on('failed', (job, err) => {
  logger.error(`Email job ${job.id} failed after retries: ${err.message}`);
});

// Handle job retry
emailQueue.on('stalled', (job) => {
  logger.warn(`Email job ${job.id} stalled, will retry`);
});

/**
 * Add email to queue
 */
export const queueEmail = async (
  to: string,
  template: string,
  data: Record<string, any>
): Promise<void> => {
  try {
    const job = await emailQueue.add(
      {
        to,
        template,
        data
      },
      {
        jobId: `${to}-${Date.now()}`,
        priority: 5
      }
    );

    logger.info(`Email queued: job ${job.id} for ${to}`);
  } catch (error: any) {
    logger.error(`Failed to queue email to ${to}: ${error.message}`, error);
    throw error;
  }
};

/**
 * Bulk queue emails
 */
export const queueBulkEmails = async (
  emails: Array<{ to: string; template: string; data: Record<string, any> }>
): Promise<void> => {
  try {
    const jobs = await emailQueue.addBulk(
      emails.map((email) => ({
        data: email,
        opts: {
          jobId: `${email.to}-${Date.now()}-${Math.random()}`,
          priority: 5
        }
      }))
    );

    logger.info(`Bulk email queued: ${jobs.length} emails added to queue`);
  } catch (error: any) {
    logger.error(`Failed to bulk queue emails: ${error.message}`, error);
    throw error;
  }
};

/**
 * Close queue
 */
export const closeEmailQueue = async (): Promise<void> => {
  await emailQueue.close();
};
