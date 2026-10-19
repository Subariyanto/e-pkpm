import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/*
 * Pulihkan diri saat chunk lama sudah tidak ada di server.
 *
 * Setiap deploy menghasilkan nama berkas baru (index-XXXX.js). Bila perangkat
 * masih memegang index.html lama — biasa terjadi di peramban ponsel yang
 * meng-cache agresif — impor dinamis ke potongan yang sudah dihapus akan gagal
 * dengan "Failed to fetch dynamically imported module".
 *
 * Vite memancarkan peristiwa `vite:preloadError` untuk kasus ini. Kita muat
 * ulang halaman sekali agar index.html baru terambil. Penjaga di
 * sessionStorage mencegah pemuatan ulang berulang bila server benar-benar
 * sedang bermasalah.
 */
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  const kunci = 'epkpm:pulih-chunk';
  const terakhir = Number(sessionStorage.getItem(kunci) || 0);
  // Jangan mencoba lagi bila percobaan sebelumnya kurang dari 30 detik lalu.
  if (Date.now() - terakhir < 30_000) return;
  sessionStorage.setItem(kunci, String(Date.now()));
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
