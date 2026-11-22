import { createId } from '../utils/ids.js';
import { getStore, updateStore } from '../services/storage.js';
import {
  createSosAlert,
  dispatchSosVolunteer,
  updateSosAlert,
  updateSosVolunteerStatus
} from '../services/emergency-sos.js';

const presence = new Map();
const room = code => `group:${code}`;

export function configureSockets(io) {
  io.on('connection', socket => {
    socket.on('group:join', async ({ code, name } = {}, acknowledge = () => { }) => {
      try {
        const normalized = String(code || '').toUpperCase();
        const group = (await getStore()).groups.find(item => item.code === normalized);
        if (!group) return acknowledge({ ok: false, error: 'Group not found' });
        const memberName = String(name || 'Guest').trim().slice(0, 32) || 'Guest';
        const member = { id: socket.id, name: memberName, joinedAt: new Date().toISOString() };
        socket.data.memberName = memberName;
        for (const [previous, sockets] of presence) {
          if (sockets.has(socket.id)) { sockets.delete(socket.id); io.to(room(previous)).emit('members:update', [...sockets.values()]); }
        }
        socket.data.groupCode = normalized;
        socket.join(room(normalized));
        if (!presence.has(normalized)) presence.set(normalized, new Map());
        presence.get(normalized).set(socket.id, member);
        io.to(room(normalized)).emit('members:update', [...presence.get(normalized).values()]);
        acknowledge({ ok: true, group, member });
      } catch { acknowledge({ ok: false, error: 'Unable to join right now' }); }
    });
    socket.on('message:send', async ({ text, clientId } = {}, acknowledge = () => { }) => {
      const groupCode = socket.data.groupCode;
      const body = String(text || '').trim().slice(0, 2000);
      const member = presence.get(groupCode)?.get(socket.id);
      if (!groupCode || !member || !body) return acknowledge({ ok: false, error: 'Join a group and enter a message first' });
      const message = { id: createId(10), clientId, groupCode, sender: member.name, text: body, createdAt: new Date().toISOString() };
      try {
        await updateStore(store => store.messages.push(message));
        io.to(room(groupCode)).emit('message:new', message);
        acknowledge({ ok: true, message });
      } catch { acknowledge({ ok: false, error: 'Message could not be saved' }); }
    });
    socket.on('sos:create', async (payload = {}, acknowledge = () => {}) => {
      const groupCode = socket.data.groupCode;
      const member = presence.get(groupCode)?.get(socket.id);
      if (!groupCode || !member) return acknowledge({ ok: false, error: 'Join a group before sending an SOS' });
      try {
        const result = await createSosAlert({ ...payload, groupCode, reporter: member.name });
        if (result.error) return acknowledge({ ok: false, error: result.error });
        io.to(room(groupCode)).emit('sos:created', result.alert);
        for (const alert of result.surgeAlerts || []) {
          if (alert.id !== result.alert.id) io.to(room(groupCode)).emit('sos:updated', alert);
        }
        acknowledge({ ok: true, alert: result.alert });
      } catch { acknowledge({ ok: false, error: 'SOS alert could not be saved' }); }
    });
    for (const action of ['acknowledge', 'resolve']) {
      socket.on(`sos:${action}`, async ({ alertId } = {}, acknowledge = () => {}) => {
        const groupCode = socket.data.groupCode;
        const member = presence.get(groupCode)?.get(socket.id);
        if (!groupCode || !member) return acknowledge({ ok: false, error: 'Join a group before updating an SOS' });
        try {
          const result = await updateSosAlert({ groupCode, alertId, action, actor: member.name });
          if (result.error) return acknowledge({ ok: false, error: result.error });
          io.to(room(groupCode)).emit('sos:updated', result.alert);
          acknowledge({ ok: true, alert: result.alert });
        } catch { acknowledge({ ok: false, error: 'SOS alert could not be updated' }); }
      });
    }
    socket.on('sos:dispatch', async ({ alertId, volunteer, volunteerId, eta, etaMinutes } = {}, acknowledge = () => {}) => {
      const groupCode = socket.data.groupCode;
      const member = presence.get(groupCode)?.get(socket.id);
      if (!groupCode || !member) return acknowledge({ ok: false, error: 'Join a group before dispatching a volunteer' });
      const groupMembers = [...(presence.get(groupCode)?.values() || [])];
      const requestedVolunteer = String(volunteerId || volunteer || '').trim();
      const assignedVolunteer = groupMembers.find(candidate => candidate.id === requestedVolunteer || candidate.name.toLowerCase() === requestedVolunteer.toLowerCase());
      if (!assignedVolunteer) return acknowledge({ ok: false, error: 'Choose an online volunteer from this group' });
      try {
        const result = await dispatchSosVolunteer({
          groupCode,
          alertId,
          volunteer: assignedVolunteer.name,
          volunteerId: assignedVolunteer.id,
          eta: eta ?? etaMinutes,
          dispatcher: member.name
        });
        if (result.error) return acknowledge({ ok: false, error: result.error });
        io.to(room(groupCode)).emit('sos:dispatch', result.alert);
        acknowledge({ ok: true, alert: result.alert });
      } catch { acknowledge({ ok: false, error: 'Volunteer dispatch could not be saved' }); }
    });
    socket.on('sos:volunteer_update', async ({ alertId, status } = {}, acknowledge = () => {}) => {
      const groupCode = socket.data.groupCode;
      const member = presence.get(groupCode)?.get(socket.id);
      if (!groupCode || !member) return acknowledge({ ok: false, error: 'Join a group before updating a dispatch' });
      try {
        const result = await updateSosVolunteerStatus({ groupCode, alertId, status, actor: member.name, actorId: member.id });
        if (result.error) return acknowledge({ ok: false, error: result.error });
        io.to(room(groupCode)).emit('sos:volunteer_update', result.alert);
        acknowledge({ ok: true, alert: result.alert });
      } catch { acknowledge({ ok: false, error: 'Volunteer update could not be saved' }); }
    });
    socket.on('disconnect', () => {
      const code = socket.data.groupCode;
      if (code && presence.has(code)) {
        presence.get(code).delete(socket.id);
        io.to(room(code)).emit('members:update', [...presence.get(code).values()]);
        if (!presence.get(code).size) presence.delete(code);
      }
    });
  });
}
