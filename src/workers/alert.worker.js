/**
 * Alert Worker
 *
 * RabbitMQ consumer for contract expiry alert jobs.
 * Receives jobs from the expiry cron and dispatches notifications.
 */

import { getChannel } from '../config/rabbitmq.js';
import { getRedisClient } from '../config/redis.js';
import { QUEUES } from '../constants/queues.js';
import * as alertService from '../services/alert.service.js';
import logger from '../utils/logger.js';

const ALERT_QUEUE = QUEUES.ALERT;

/** Start consuming alert jobs from the queue. */
export async function startAlertWorker() {
    const channel = getChannel();
    if (!channel) {
        logger.error('Cannot start alert worker — RabbitMQ channel not available');
        return;
    }

    logger.info(`Alert worker listening on queue: ${ALERT_QUEUE}`);

    channel.consume(ALERT_QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            const redis = getRedisClient();
            await alertService.processExpiryAlert(payload, redis);
            channel.ack(msg);
        } catch (err) {
            logger.error('Alert job failed:', err.message);
            channel.nack(msg, false, false); // Don't requeue failed alerts
        }
    }, { noAck: false });
}
