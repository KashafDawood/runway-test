declare module 'node-cron' {
  export interface ScheduledTask {
    stop(): void;
  }

  export function schedule(
    cronExpression: string,
    task: () => void,
    options?: { scheduled?: boolean; timezone?: string }
  ): ScheduledTask;

  export function validate(cronExpression: string): boolean;

  const cron: {
    schedule: typeof schedule;
    validate: typeof validate;
  };

  export default cron;
}
