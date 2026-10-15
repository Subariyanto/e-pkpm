/**
 * Post-build untuk GitHub Pages (SPA fallback).
 *
 * Aplikasi memakai BrowserRouter, sehingga URL seperti /pengaturan, /rekap,
 * /penilaian diminta langsung ke server. GitHub Pages hanya menyajikan file
 * statis, jadi URL tersebut berakhir 404 "File not found".
 *
 * Solusi baku: sediakan 404.html yang isinya identik dengan index.html.
 * GitHub Pages akan menyajikan 404.html untuk path apa pun yang tidak
 * ditemukan, React Router lalu mengambil alih dan merender halaman yang benar.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const indexHtml = join(dist, 'index.html');

if (!existsSync(indexHtml)) {
  console.error('[postbuild] dist/index.html tidak ditemukan. Jalankan vite build dulu.');
  process.exit(1);
}

// 1) 404.html sebagai fallback SPA
copyFileSync(indexHtml, join(dist, '404.html'));
console.log('[postbuild] 404.html dibuat (SPA fallback).');

// 2) .nojekyll supaya GitHub Pages tidak memproses folder diawali underscore
writeFileSync(join(dist, '.nojekyll'), '');
console.log('[postbuild] .nojekyll dibuat.');

// 3) Pastikan CNAME ikut ter-deploy
const cname = join(dist, 'CNAME');
if (existsSync(cname)) {
  console.log(`[postbuild] CNAME: ${readFileSync(cname, 'utf8').trim()}`);
} else {
  console.warn('[postbuild] Peringatan: dist/CNAME tidak ada — custom domain bisa lepas.');
}

console.log('[postbuild] Selesai.');
