# TikTok Automation Bot (Playwright + TypeScript)

Automasi pelaporan profil & postingan TikTok dengan dukungan eksekusi paralel multi-browser, prompt interaktif, dan target dinamis.

## Persyaratan Sistem

- **Node.js** (versi 18 ke atas, disarankan versi LTS): [Download Node.js](https://nodejs.org/)

---

## 1. Setup Awal (Cukup sekali saja)
Dobel klik file **`setup.bat`** (Windows) atau jalankan perintah berikut di terminal:

```bash
npm install
npx playwright install chromium
```

---

## 2. Cara Menjalankan Bot

### Mode Interaktif (Sangat Direkomendasikan)
Cukup jalankan perintah:

```bash
npm start
```

Bot akan langsung menanyakan interaktif di terminal:
1. **Mau takedown apa?**
   - `[1]` Akun / Profil TikTok
   - `[2]` Postingan / Video / Foto TikTok
2. **Masukkan link target:**
   - Untuk Akun: Link profil atau username (contoh: `@username` atau `https://www.tiktok.com/@username`)
   - Untuk Postingan: Link postingan (contoh: `https://www.tiktok.com/@username/video/12345...` atau `.../photo/12345...`)
3. **Jumlah putaran (runs)** (default: 1)
4. **Jumlah browser paralel** (default: 1)

*(Bagi pengguna Windows, Anda juga bisa langsung dobel klik file **`run.bat`**).*

---

### Mode Baris Perintah (CLI Argument)
Anda juga bisa langsung menyertakan argumen:

```bash
npm start [tipe] <jumlah_putaran> <jumlah_browser> [link_target]
```

#### Contoh Pelaporan Akun:
```bash
npm start account 1 5 @target.user
npm start 1 5 https://www.tiktok.com/@target.user
```

#### Contoh Pelaporan Postingan:
```bash
npm start post 1 5 https://www.tiktok.com/@target.user/video/1234567890
npm start 1 3 https://www.tiktok.com/@target.user/photo/7699855175837633793
```
*(Jika memasukkan link yang mengandung `/video/` atau `/photo/`, bot otomatis mengenali target sebagai postingan).*
