import { Router } from 'express';
import { createSosAlert, listSosAlerts, updateSosAlert } from '../services/emergency-sos.js';

const router = Router();
const room = code => `group:${code}`;
const broadcast = (req, code, event, alert) => req.app.get('io')?.to(room(code)).emit(event, alert);

router.get('/:code', async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const alerts = await listSosAlerts(code);
    if (!alerts) return res.status(404).json({ error: 'Group not found' });
    res.json(alerts);
  } catch (error) { next(error); }
});

router.post('/:code', async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const result = await createSosAlert({ ...req.body, groupCode: code, reporter: req.body?.reporter || req.body?.createdBy });
    if (result.error) return res.status(result.error === 'Group not found' ? 404 : 400).json({ error: result.error });
    broadcast(req, code, 'sos:created', result.alert);
    for (const alert of result.surgeAlerts || []) {
      if (alert.id !== result.alert.id) broadcast(req, code, 'sos:updated', alert);
    }
    res.status(201).json(result.alert);
  } catch (error) { next(error); }
});

for (const action of ['acknowledge', 'resolve']) {
  router.post('/:code/:alertId/' + action, async (req, res, next) => {
    try {
      const code = req.params.code.toUpperCase();
      const result = await updateSosAlert({ groupCode: code, alertId: req.params.alertId, action, actor: req.body?.actor || req.body?.name });
      if (result.error) return res.status(result.error === 'Group not found' || result.error === 'SOS alert not found' ? 404 : 409).json({ error: result.error });
      broadcast(req, code, 'sos:updated', result.alert);
      res.json(result.alert);
    } catch (error) { next(error); }
  });
}

export default router;
