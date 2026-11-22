import forge from 'node-forge';
import { networkInterfaces } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const certificateDirectory = resolve(projectRoot, 'node_modules/.vite/groundlink-https');
const certificatePath = resolve(certificateDirectory, 'lan-cert.pem');
const keyPath = resolve(certificateDirectory, 'lan-key.pem');
const metadataPath = resolve(certificateDirectory, 'lan-cert.json');

function lanAddresses() {
  const addresses = new Set();
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.internal) continue;
      const family = entry.family;
      const address = entry.address.split('%')[0];
      if (family === 'IPv4' || family === 4 || family === 'IPv6' || family === 6) {
        addresses.add(address);
      }
    }
  }
  return [...addresses].sort();
}

async function createCertificate(addresses) {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16)).replace(/^0+/, '') || '01';
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const name = [{ name: 'commonName', value: 'GroundLink LAN Development' }];
  certificate.setSubject(name);
  certificate.setIssuer(name);
  certificate.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
        ...addresses.map(address => ({ type: 7, ip: address })),
      ],
    },
  ]);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  return {
    key: forge.pki.privateKeyToPem(keys.privateKey),
    cert: forge.pki.certificateToPem(certificate),
  };
}

export async function getLanHttpsOptions() {
  const addresses = lanAddresses();
  await mkdir(certificateDirectory, { recursive: true });

  try {
    const [metadataText, key, cert] = await Promise.all([
      readFile(metadataPath, 'utf8'),
      readFile(keyPath, 'utf8'),
      readFile(certificatePath, 'utf8'),
    ]);
    const metadata = JSON.parse(metadataText);
    const recentEnough = Date.now() - metadata.createdAt < 180 * 24 * 60 * 60 * 1000;
    if (recentEnough && JSON.stringify(metadata.addresses) === JSON.stringify(addresses)) return { key, cert };
  } catch { /* Generate a certificate if no matching LAN certificate is cached. */ }

  const tls = await createCertificate(addresses);
  await Promise.all([
    writeFile(keyPath, tls.key, { mode: 0o600 }),
    writeFile(certificatePath, tls.cert),
    writeFile(metadataPath, JSON.stringify({ createdAt: Date.now(), addresses }, null, 2)),
  ]);
  return tls;
}
