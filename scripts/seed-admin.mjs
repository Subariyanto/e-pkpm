#!/usr/bin/env node
/**
 * Seed admin pertama e-PKPM lewat REST callable `seedAdmin`.
 * Token Google diambil dari configstore firebase-tools, ditukar jadi
 * Firebase ID token lewat securetoken (apiKey Web), lalu callable dipanggil
 * dengan Authorization: Bearer <idToken>.
 *
 * Pakai: node scripts/seed-admin.mjs
 * Env:   ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_NAMA, ADMIN_ORG, BOOTSTRAP_KEY
 *        (baca otomatis dari ../.env bila tidak diset)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const akar = path.resolve(import.meta.dirname, '..');

function bacaEnv() {
  const out = {};
  const f = path.join(akar, '.env');
  if (fs.existsSync(f)) {
    for (const baris of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = baris.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return out;
}

const env = bacaEnv();
const PROJECT = process.env.FIREBASE_PROJECT || env.VITE_FIREBASE_PROJECT_ID || 'aplikasi-pkpm';
const API_KEY = process.env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY;
const USERNAME = process.env.ADMIN_USERNAME || 'subariyanto';
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const NAMA = process.env.ADMIN_NAMA || 'Subariyanto, S.Pd., M.Pd.I.';
const ORG = process.env.ADMIN_ORG || 'POKJAWAS-JEMBER';
const BOOTSTRAP = process.env.BOOTSTRAP_KEY || '';

if (!API_KEY) { console.error('apiKey Firebase tidak ditemukan'); process.exit(1); }
if (!PASSWORD) { console.error('ADMIN_PASSWORD wajib diisi'); process.exit(1); }
if (!BOOTSTRAP) { console.error('BOOTSTRAP_KEY wajib diisi'); process.exit(1); }

/** Ambil access token Google dari configstore firebase-tools. */
function tokenGoogle() {
  const p = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return j.tokens.access_token;
}

/** Tukar access token Google + apiKey menjadi Firebase custom token? Tidak:
 *  kita pakai signInWithIdp? Lebih sederhana: buat akun admin lewat
 *  seedAdmin yang menerima bootstrapKey — tidak perlu login admin. */
async function main() {
  const url = `https://asia-southeast2-${PROJECT}.cloudfunctions.net/seedAdmin`;
  const body = {
    data: {
      bootstrapKey: BOOTSTRAP,
      username: USERNAME,
      password: PASSWORD,
      nama: NAMA,
      orgId: ORG,
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const teks = await r.text();
  console.log('HTTP', r.status);
  console.log(teks);
}

main().catch((e) => { console.error(e); process.exit(1); });
