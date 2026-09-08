import { json } from './_util.js';
export async function onRequestGet({ env }) {
  return json({ ready: !!env.DB, service: 'hongot' });
}
