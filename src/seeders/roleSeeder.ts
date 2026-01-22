import mongoose from 'mongoose';
import { Role } from '@components/role/v1/role.model';
import { FIXED_ROLES } from '@components/role/v1/role.constants';
import config from '@config/config';
import logger from '@core/utils/logger';

/**
 * Seed roles into database
 * This should be run once when setting up the database
 */
export const seedRoles = async (): Promise<void> => {
  try {
    logger.info('Starting role seeder...');

    // Check if roles already exist
    const existingRolesCount = await Role.countDocuments();
    
    if (existingRolesCount > 0) {
      logger.info(`Roles already seeded. Found ${existingRolesCount} roles.`);
      return;
    }

    // Insert fixed roles
    await Role.insertMany(FIXED_ROLES);
    
    logger.info(`Successfully seeded ${FIXED_ROLES.length} roles`);
    
    // Log created roles
    const roles = await Role.find();
    roles.forEach(role => {
      logger.info(`  - ${role.displayName} (${role.name}) - Admin: ${role.isAdmin}`);
    });

  } catch (error) {
    logger.error('Error seeding roles:', error);
    throw error;
  }
};

/**
 * Run seeder as standalone script
 */
const runSeeder = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.db.mongo_uri);
    logger.info('Database connected');

    // Run seeder
    await seedRoles();

    logger.info('Seeder completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Seeder failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runSeeder();
}

export default seedRoles;
