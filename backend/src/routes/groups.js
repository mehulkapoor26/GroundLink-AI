import { Router } from 'express';
import { createId } from '../utils/ids.js';
import { getStore, updateStore } from '../services/storage.js';

const router = Router();
router.get('/', async (_req, res, next) => {
  try { const { groups } = await getStore(); res.json(groups); } catch (e) { next(e); }
});
router.get('/id/:id', async (req, res, next) => {
  try {
    const group = (await getStore()).groups.find(item => item.id === req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (e) { next(e); }
});
router.get('/:code', async (req, res, next) => {
  try {
    const group = (await getStore()).groups.find(item => item.code === req.params.code.toUpperCase());
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (e) { next(e); }
});
router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 60);
    const createdBy = String(req.body.createdBy || 'Coordinator').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Group name is required' });
    const group = { id: createId(12), code: createId(4), name, createdBy, createdAt: new Date().toISOString() };
    await updateStore(store => store.groups.push(group));
    res.status(201).json(group);
  } catch (e) { next(e); }
});
router.post('/:code/join', async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const group = (await getStore()).groups.find(item => item.code === code);
    if (!group) return res.status(404).json({ error: 'That group code was not found' });
    res.json(group);
  } catch (e) { next(e); }
});
export default router;
