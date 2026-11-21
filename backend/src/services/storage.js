import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const file = resolve('backend/src/data/store.json');
const initial = { groups: [], messages: [] };
let queue = Promise.resolve();

async function read() {
  try { return { ...initial, ...JSON.parse(await readFile(file, 'utf8')) }; }
  catch (error) { if (error.code !== 'ENOENT') throw error; return structuredClone(initial); }
}

export async function updateStore(mutator) {
  const operation = queue.then(async () => {
    const state = await read();
    const result = await mutator(state);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(state, null, 2));
    return result;
  });
  queue = operation.catch(() => {});
  return operation;
}

export async function getStore() {
  await queue;
  return read();
}
