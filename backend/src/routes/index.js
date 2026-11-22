import { Router } from 'express';
import adminRoutes from './admin.js';
import groups from './groups.js';
import attendance from './attendance.js';
import emergencySos from './emergency-sos.js';
import voice from './voice.js';
import gnani from './gnani.js';
import { getStore } from '../services/storage.js';

const router = Router();
router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'groundlink-api', time: new Date().toISOString() }));
router.use('/groups', groups);
router.use('/attendance', attendance);
router.use('/admin', adminRoutes);
router.use('/emergency-sos', emergencySos);
router.use('/voice', voice);
router.use('/gnani', gnani);

router.get('/groups/:code/messages', async (req, res, next) => {
  try {
    const store = await getStore();
    res.json(store.messages.filter(message => message.groupCode === req.params.code.toUpperCase()).slice(-100));
  } catch (e) { next(e); }
});

export default router;