# e-PKPM
Sistem Penilaian Kinerja Pengawas Madrasah berbasis React, Vite, TypeScript, PWA, dan IndexedDB/Dexie. Data PKPM tidak dikirim ke server; Supabase hanya untuk aktivasi/lisensi.

## Persyaratan
- Node.js 22+
- npm

## Instalasi dan menjalankan
```bash
npm ci
npm run dev
```
Buka URL Vite. Untuk data contoh, klik **Aktifkan Data Demo**, lalu masuk dengan `admin` / `123456`.

Aktivasi produksi memerlukan `.env` dari `.env.example` dan skema `supabase/schema.sql`. Mode demo otomatis untuk pengujian E2E saja diatur oleh konfigurasi Playwright.

## Verifikasi
```bash
npm test
npm run build
npx playwright install chromium
npm run e2e
```
- Unit test: Vitest.
- E2E: Playwright Chromium; server Vite lokal dijalankan otomatis pada `127.0.0.1:4173`.
- Artefak gagal: `test-results/`, trace, screenshot; laporan HTML: `playwright-report/`.
- Screenshot alur sukses: `test-results/dashboard.png` dan `test-results/laporan.png`.

## Build dan preview
```bash
npm run build
npm run preview
```
Artefak produksi berada di `dist/`. Uji instalasi/offline PWA melalui HTTPS atau localhost. IndexedDB tidak dibersihkan ketika service worker diperbarui; lakukan backup berkala.

## Deploy
Deploy seluruh isi `dist/` ke host statis HTTPS dengan fallback SPA ke `index.html`.

Untuk GitHub project Pages, ubah `base` pada `vite.config.ts` menjadi `'/nama-repo/'`, build, lalu unggah `dist/`. CI direkomendasikan memakai Node 22+, `npm ci`, `npm test`, `npm run build`, dan `npm run e2e` sebelum deploy.

## Fitur utama
- Login PIN SHA-256, pembatasan gagal login, sesi lokal, peran Admin/Penilai.
- CRUD periode, pengawas, penilai, instrumen/bobot/deskriptor skor 0–4, predikat; validasi relasi dan audit.
- Pembagian, telaah, finalisasi terkunci, kalkulasi berbobot K1–K4, rekap, PKB.
- Laporan multi-BAB PDF/XLSX, checksum transfer, backup/restore organisasi.
- PWA responsif/offline; pemuatan modul ekspor secara dinamis.

## Keamanan dan keterbatasan
`npm audit --omit=dev` saat dokumentasi ini diperbarui melaporkan 1 kerentanan high pada `xlsx` (prototype pollution/ReDoS) tanpa perbaikan upstream. Mitigasi: ekspor hanya data lokal tepercaya; jangan memproses workbook XLSX dari sumber tak tepercaya. Pertimbangkan migrasi library sebelum menambahkan impor XLSX.
