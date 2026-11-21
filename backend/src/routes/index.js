import { Router } from 'express';
import adminRoutes from './admin.js';
import groups from './groups.js';
import { getStore } from '../services/storage.js';

const router = Router();
router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'groundlink-api', time: new Date().toISOString() }));
router.use('/groups', groups);
router.use('/admin', adminRoutes);
router.get('/groups/:code/messages', async (req, res, next) => {
  try {
    const store = await getStore();
    res.json(store.messages.filter(message => message.groupCode === req.params.code.toUpperCase()).slice(-100));
  } catch (e) { next(e); }
});
export default router;
