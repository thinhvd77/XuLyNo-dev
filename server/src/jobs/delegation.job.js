const cron = require('node-cron');
const delegationService = require('../services/delegation.service');
const logger = require('../config/logger');

/**
 * Scheduled job to automatically expire delegations that have passed their expiry date
 * Runs every hour and sends WebSocket notifications to affected users
 */
const expireDelegationsJob = cron.schedule(
  '0 * * * *',
  async () => {
    try {
      logger.info('Starting automatic delegation expiration job');

      const result = await delegationService.expireOverdueDelegationsWithNotification();

      if (result.expiredCount > 0) {
        logger.info(
          `Automatic delegation expiration completed: ${result.expiredCount} delegations expired, ${result.notificationsSent} notifications sent`,
        );
      } else {
        logger.debug('Automatic delegation expiration completed: no delegations to expire');
      }
    } catch (error) {
      logger.error('Error in automatic delegation expiration job:', error);
    }
  },
  {
    scheduled: false, // Don't start immediately
    timezone: 'Asia/Ho_Chi_Minh',
  },
);

/**
 * Start the delegation expiration job
 */
const startDelegationJob = () => {
  try {
    expireDelegationsJob.start();
    logger.info('Delegation expiration job started - runs every hour');
  } catch (error) {
    logger.error('Failed to start delegation expiration job:', error);
  }
};

/**
 * Stop the delegation expiration job
 */
const stopDelegationJob = () => {
  try {
    expireDelegationsJob.stop();
    logger.info('Delegation expiration job stopped');
  } catch (error) {
    logger.error('Error stopping delegation expiration job:', error);
  }
};

module.exports = {
  startDelegationJob,
  stopDelegationJob,
  expireDelegationsJob,
};
