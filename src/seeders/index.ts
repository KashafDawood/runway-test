import mongoose from 'mongoose';
import seedRoles from './roleSeeder';
import config from '@config/config';
import logger from '@core/utils/logger';

/**
 * Run all seeders
 */
const runAllSeeders = async () => {
  try {
    logger.info('=================================');
    logger.info('Starting database seeders...');
    logger.info('=================================');

    // Connect to database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.db.mongo_uri);
      logger.info('Database connected');
    }

    // Run seeders
    await seedRoles();

    logger.info('=================================');
    logger.info('All seeders completed successfully');
    logger.info('=================================');

    // Close connection if we opened it
    if (require.main === module) {
      await mongoose.disconnect();
      process.exit(0);
    }
  } catch (error) {
    logger.error('Seeders failed:', error);
    if (require.main === module) {
      process.exit(1);
    }
  }
};

// Run if called directly
if (require.main === module) {
  runAllSeeders();
}

export default runAllSeeders;
