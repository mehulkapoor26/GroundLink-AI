import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { getStore, updateStore } from '../services/storage.js';

const router = Router();

router.post('/createSession', async (req, res, next) => {
  try {
    const title = String(req.body?.title || req.body?.name || 'Attendance Session').trim().slice(0, 80);
    const groupCode = String(req.body?.groupCode || '').trim().toUpperCase();
    const sessionCode = randomBytes(3).toString('hex').toUpperCase();
    const session = {
      id: randomBytes(6).toString('hex'),
      sessionCode,
      title,
      groupCode,
      status: 'open',
      createdAt: new Date().toISOString(),
      attendees: [],
    };
    await updateStore(store => {
      store.attendanceSessions = store.attendanceSessions || [];
      store.attendanceSessions.push(session);
    });
    res.status(201).json({ ...session, session });
  } catch (e) { next(e); }
});

async function handleCheckIn(req, res, next) {
  try {
    const code = String(
      req.body?.sessionCode || req.body?.code || req.body?.attendanceCode || req.body?.sessionId || ''
    ).trim().toUpperCase();
    const memberName = String(
      req.body?.memberName || req.body?.name || req.body?.attendeeName || ''
    ).trim().slice(0, 60);
    const rollOrId = String(req.body?.rollNumber || req.body?.rollNo || req.body?.memberId || '').trim().slice(0, 40);

    if (!code) return res.status(400).json({ error: 'Attendance code is required' });
    if (!memberName) return res.status(400).json({ error: 'Member name is required' });

    const result = await updateStore(store => {
      store.attendanceSessions = store.attendanceSessions || [];
      const session = store.attendanceSessions.find(
        s => s.sessionCode === code || s.id.toUpperCase() === code
      );
      if (!session) return { error: 'Invalid or closed attendance session', status: 404 };
      if (session.status === 'closed') return { error: 'Attendance session is closed', status: 400 };

      const existingIdx = session.attendees.findIndex(
        a => String(a.memberName || a.name || '').toLowerCase() === memberName.toLowerCase()
      );
      const entry = {
        id: existingIdx >= 0 ? session.attendees[existingIdx].id : randomBytes(4).toString('hex'),
        memberName,
        name: memberName,
        rollNumber: rollOrId,
        checkedInAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) session.attendees[existingIdx] = entry;
      else session.attendees.push(entry);

      return { status: 200, entry };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.entry);
  } catch (e) { next(e); }
}

router.post('/checkIn', handleCheckIn);
router.post('/checkin', handleCheckIn);

router.get('/attendees/:sessionId', async (req, res, next) => {
  try {
    const key = String(req.params.sessionId || '').trim().toUpperCase();
    const store = await getStore();
    const session = (store.attendanceSessions || []).find(
      s => s.id.toUpperCase() === key || s.sessionCode === key
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session.attendees);
  } catch (e) { next(e); }
});

router.post('/closeSession', async (req, res, next) => {
  try {
    const id = String(req.body?.sessionId || req.body?.id || req.body?.sessionCode || '').trim();
    const result = await updateStore(store => {
      const session = (store.attendanceSessions || []).find(
        s => s.id === id || s.sessionCode === id.toUpperCase()
      );
      if (!session) return { error: 'Session not found', status: 404 };
      session.status = 'closed';
      session.closedAt = new Date().toISOString();
      return { status: 200, session };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json({ ok: true, session: result.session });
  } catch (e) { next(e); }
});

export default router;
