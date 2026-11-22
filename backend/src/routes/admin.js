import { Router } from 'express';
import { getStore } from '../services/storage.js';

const router = Router();

router.get('/stats', async (req, res, next) => {
  try {
    const store = await getStore();
    
    const stats = {
      totalGroups: store.groups ? store.groups.length : 0,
      status: 'active'
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;