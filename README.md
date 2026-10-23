# TikTok Automation Bot (Playwright + TypeScript)

Automasi pelaporan profil TikTok dengan dukungan eksekusi paralel multi-browser dan target URL dinamis.

## Persyaratan Sistem

- **Node.js** (versi 18 ke atas, disarankan versi LTS): [Download Node.js](https://nodejs.org/)

---

## Panduan Penggunaan di Windows

### 1. Setup Awal (Cukup sekali saja)
Dobel klik file **`setup.bat`** atau jalankan perintah berikut di Command Prompt (CMD) / PowerShell:

```cmd
npm install
npx playwright install chromium
```

Script ini akan:
- Memeriksa instalasi Node.js & NPM
- Menginstal dependensi (Playwright, TSX, TypeScript)
- Mengunduh browser Chromium khusus Playwright untuk Windows

---

### 2. Menjalankan Bot di Windows

#### Cara A: Dobel Klik `run.bat`
1. Dobel klik file **`run.bat`**.
2. Masukkan jumlah putaran (contoh: `1`).
3. Masukkan jumlah browser paralel (contoh: `5`).
4. Masukkan link atau username profil TikTok (contoh: `@pojok.lamongan` atau tekan Enter untuk default).
5. Bot akan otomatis membuka browser dan menjalankan alur sampai selesai.

#### Cara B: Menggunakan Command Prompt / PowerShell
Buka terminal di folder ini lalu jalankan:

```cmd
npm start <jumlah_putaran> <jumlah_browser> [link_atau_username]
```

**Contoh 1: Menggunakan URL lengkap**
```cmd
npm start 1 5 https://www.tiktok.com/@pojok.lamongan
```

**Contoh 2: Menggunakan format @username langsung**
```cmd
npm start 1 5 @pojok.lamongan
```

**Contoh 3: Menggunakan default URL (otomatis target @pojok.lamongan)**
```cmd
npm start 2 2
```
