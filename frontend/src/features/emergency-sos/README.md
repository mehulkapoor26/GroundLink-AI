# Emergency SOS

SOS alerts are scoped to the active local group. Members can send a confirmed alert with a category and optional note or zone, acknowledge active alerts, and resolve them. Alert state is stored in the host's local JSON store and changes are broadcast to the group's Socket.IO room.

The module requires a reachable group host on the local network. It does not contact emergency services.
