export function getShareOrigin() {
  const { hostname, origin, protocol, port } = window.location;
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  const lanIp = import.meta.env.VITE_LAN_IP;
  if (isLoopback && lanIp) return `${protocol}//${lanIp}${port ? `:${port}` : ''}`;
  return origin;
}
