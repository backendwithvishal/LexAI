/**
 * Health Check Route
 *
 * Base path: /health  (mounted directly in app.js, not under /api/v1)
 *
 * Unauthenticated — used by Docker health checks and load balancer probes.
 * Returns 200 if all services are healthy, 503 if any are degraded.
 * Response body includes per-service status for debugging.
 */

import { Router } from 'express';
import { isMongoHealthy } from '../config/db.js';
import { isRedisHealthy } from '../config/redis.js';
import { isRabbitHealthy } from '../config/rabbitmq.js';

const router = Router();

router.get('/', async (req, res) => {
    // Check all three services in parallel for speed
    const [mongoOk, redisOk, rabbitOk] = await Promise.all([
        isMongoHealthy().catch(() => false),
        isRedisHealthy().catch(() => false),
        Promise.resolve(isRabbitHealthy()),
    ]);

    const allHealthy = mongoOk && redisOk && rabbitOk;

    const body = {
        status: allHealthy ? 'ok' : 'degraded',
        services: {
            mongodb: mongoOk ? 'up' : 'down',
            redis: redisOk ? 'up' : 'down',
            rabbitmq: rabbitOk ? 'up' : 'down',
        },
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),  // seconds since process started
    };

    // 503 tells the load balancer to stop routing traffic to this instance
    res.status(allHealthy ? 200 : 503).json(body);
});

export default router;
