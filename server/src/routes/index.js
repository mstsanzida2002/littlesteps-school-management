import { Router } from 'express';

import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);

// Feature routers are mounted here as they are built, e.g.:
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);

export default router;
