import { Router } from 'express';
import groups from './groups.js';
import emergencySos from './emergency-sos.js';
import { getStore } from '../services/storage.js';

const router = Router();
router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'groundlink-api', time: new Date().toISOString() }));
router.use('/groups', groups);
router.use('/emergency-sos', emergencySos);
router.get('/groups/:code/messages', async (req, res, next) => {
  try {
    const store = await getStore();
    res.json(store.messages.filter(message => message.groupCode === req.params.code.toUpperCase()).slice(-100));
  } catch (e) { next(e); }
});
export default router;
