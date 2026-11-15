# Monopoli Nusantara Online — Design Spec

## Ringkasan

Game Monopoli bertema kota-kota Indonesia, multiplayer real-time berbasis web. Tanpa login — pemain isi nama, pilih pion, buat/gabung room via kode 6 karakter. 2–4 pemain + opsi Bot AI. Visual 2D modern dengan animasi smooth.

## Arsitektur

```
Browser (Vanilla JS + CSS)
    ↕ WebSocket (Socket.IO)
Node.js Server (game state in-memory)
```

- **Frontend:** HTML5 + Vanilla JS + CSS. Tidak pakai framework.
- **Backend:** Node.js + Socket.IO. Satu-satunya dependency.
- **State:** In-memory per room. Tidak ada database. Room hilang saat semua pemain disconnect.
- **Hosting:** `node server.js` → `http://localhost:3000`

## Alur Pemain

1. Landing page → isi nama, pilih pion (Becak / Kapal Pinisi / Bajaj / Komodo)
2. Buat Room (dapat kode `NUS-XXX`) atau Gabung Room (masukkan kode)
3. Lobby — tampil daftar pemain, host bisa tambah Bot, klik "Mulai!" (min 2 pemain)
4. Game board aktif, giliran pertama ditentukan acak

## Papan — 40 Petak

### Layout

Persegi klasik 11×11 grid. 10 petak per sisi. Urutan searah jarum jam dari START.

### Susunan Petak

| No | Nama | Jenis | Grup/Warna | Harga |
|----|------|-------|------------|-------|
| 0 | START | Sudut | — | — |
| 1 | Banda Aceh | Properti | Coklat | 600rb |
| 2 | Dana Umum | Kartu | — | — |
| 3 | Sabang | Properti | Coklat | 600rb |
| 4 | Pajak Penghasilan | Pajak | — | 2jt |
| 5 | Bandara Soekarno-Hatta | Bandara | — | 2jt |
| 6 | Medan | Properti | Biru Muda | 1jt |
| 7 | Kesempatan | Kartu | — | — |
| 8 | Padang | Properti | Biru Muda | 1jt |
| 9 | Bukittinggi | Properti | Biru Muda | 1.2jt |
| 10 | Penjara (Berkunjung) | Sudut | — | — |
| 11 | Palembang | Properti | Ungu | 1.4jt |
| 12 | PLN | Perusahaan | — | 1.5jt |
| 13 | Lampung | Properti | Ungu | 1.4jt |
| 14 | Bengkulu | Properti | Ungu | 1.6jt |
| 15 | Bandara Juanda | Bandara | — | 2jt |
| 16 | Jakarta | Properti | Oranye | 1.8jt |
| 17 | Dana Umum | Kartu | — | — |
| 18 | Bogor | Properti | Oranye | 1.8jt |
| 19 | Tangerang | Properti | Oranye | 2jt |
| 20 | Parkir Gratis | Sudut | — | — |
| 21 | Bandung | Properti | Merah | 2.2jt |
| 22 | Kesempatan | Kartu | — | — |
| 23 | Yogyakarta | Properti | Merah | 2.2jt |
| 24 | Semarang | Properti | Merah | 2.4jt |
| 25 | Bandara Ngurah Rai | Bandara | — | 2jt |
| 26 | Surabaya | Properti | Kuning | 2.6jt |
| 27 | Malang | Properti | Kuning | 2.6jt |
| 28 | PDAM | Perusahaan | — | 1.5jt |
| 29 | Denpasar | Properti | Kuning | 2.8jt |
| 30 | Masuk Penjara | Sudut | — | — |
| 31 | Makassar | Properti | Hijau | 3jt |
| 32 | Manado | Properti | Hijau | 3jt |
| 33 | Dana Umum | Kartu | — | — |
| 34 | Balikpapan | Properti | Hijau | 3.2jt |
| 35 | Bandara Sultan Hasanuddin | Bandara | — | 2jt |
| 36 | Kesempatan | Kartu | — | — |
| 37 | Jayapura | Properti | Biru Tua | 3.5jt |
| 38 | Pajak Bumi | Pajak | — | 1jt |
| 39 | Raja Ampat | Properti | Biru Tua | 4jt |

### Harga Sewa

Sewa mengikuti pola Monopoli klasik — sewa dasar sekitar 5–10% harga beli, naik per rumah, dan berlipat saat hotel.

| Bangunan | Pengali Sewa Dasar |
|----------|-------------------|
| Tanah kosong | 1x |
| 1 rumah | 5x |
| 2 rumah | 15x |
| 3 rumah | 45x |
| 4 rumah | 80x |
| Hotel | 125x |

**Bandara:** Sewa tergantung jumlah bandara yang dimiliki: 1=250rb, 2=500rb, 3=1jt, 4=2jt.

**Perusahaan (PLN/PDAM):** Sewa = lemparan dadu × 40rb (punya 1) atau × 100rb (punya 2).

## Mekanik Game

### Uang Awal

Setiap pemain mulai dengan **15 juta**. Melewati START mendapat **2 juta**.

### Giliran

1. Pemain klik "Lempar Dadu" — animasi 2 dadu spin
2. Pion bergerak petak per petak dengan animasi
3. Aksi otomatis sesuai petak
4. Timer 30 detik per giliran — auto-skip jika habis
5. Dadu double → giliran tambahan. 3x double berturut-turut → masuk penjara.

### Beli Properti

- Mendarat di properti kosong → pop-up "Beli / Lewati"
- Lewati → **Lelang otomatis** dimulai

### Lelang

- Semua pemain bisa bid
- Timer 10 detik per bid
- Mulai dari harga 0 (bebas bid berapa saja)
- Bid tertinggi saat timer habis = pemenang

### Bangun Rumah & Hotel

- Syarat: punya semua properti dalam 1 grup warna
- Bangun merata (selisih rumah antar properti di grup max 1)
- 4 rumah → upgrade ke hotel
- Hanya bisa bangun di giliran sendiri

### Gadai (Mortgage)

- Jual ke bank = 50% harga beli
- Properti tergadai tidak bisa tarik sewa
- Tebus = harga gadai + 10%

### Trade

- Klik avatar pemain lain → buka panel trade
- Tawarkan kombinasi: properti + uang ↔ properti + uang
- Lawan: Accept / Reject / Counter-offer
- Tidak bisa trade properti yang ada bangunan (harus jual rumah dulu)

### Penjara

- Masuk penjara via: petak "Masuk Penjara", kartu, atau 3x double
- Keluar: bayar 500rb, pakai kartu bebas penjara, atau lempar double (max 3 giliran coba)
- Setelah 3 giliran gagal double → wajib bayar 500rb

### Kondisi Kalah & Menang

- **Kalah:** Tidak bisa bayar kewajiban & tidak punya aset untuk dijual/digadai → bangkrut, jadi spectator
- **Menang:** Pemain terakhir yang tersisa

## Kartu Kesempatan & Dana Umum

16 kartu masing-masing, di-shuffle di awal game. Contoh:

**Kesempatan:**
- Maju ke START, terima 2jt
- Maju ke Jakarta. Jika melewati START, terima 2jt
- Mundur 3 langkah
- Bayar biaya renovasi: 250rb per rumah, 1jt per hotel
- Dapat kartu bebas penjara
- Masuk penjara langsung
- Terima hadiah 1.5jt
- Bayar denda 500rb

**Dana Umum:**
- Maju ke START
- Bank error, terima 2jt
- Bayar biaya dokter 500rb
- Dapat warisan 1jt
- Bayar asuransi 500rb per rumah
- Dapat kartu bebas penjara
- Ulang tahun! Terima 100rb dari setiap pemain
- Masuk penjara langsung

## UI & Layout

### Desktop (3-Kolom)

```
┌──────────────────────────────────────────────┐
│  Header: Logo + Room Code + Timer Giliran    │
├─────────┬───────────────────────┬────────────┤
│ Panel   │                       │ Panel      │
│ Pemain  │    PAPAN MONOPOLI     │ Properti   │
│         │    (tengah, besar)    │ & Aksi     │
│ Avatar  │                       │            │
│ Uang    │                       │ Beli/Jual  │
│ Status  │                       │ Trade      │
│ Properti│                       │ Mortgage   │
├─────────┴───────────────────────┴────────────┤
│  Chat Box + Log Aktivitas Game               │
└──────────────────────────────────────────────┘
```

### Mobile

- Papan full-screen
- Panel pemain & aksi bisa di-toggle via bottom tabs
- Dadu & aksi utama tetap visible di overlay bawah

### Animasi & Efek

- 🎲 Dadu: CSS 3D spin lalu reveal angka
- 🏃 Pion: melompat per petak, ease-in-out
- 💳 Kartu: flip card effect
- 💰 Uang: angka animasi naik/turun
- 🏠 Rumah/Hotel: pop-up animation di petak
- 🔔 Notifikasi: toast notification
- 🎵 Sound FX: lempar dadu, beli, bayar sewa, menang/kalah

### Chat

- Chat teks real-time antar pemain
- Auto-log aktivitas game
- Emoji reactions: 👍 😂 😡 🎉

## Bot AI

Logika sederhana:
- **Beli properti** jika uang cukup dan sisa uang > 30% total awal
- **Bangun rumah** jika punya grup lengkap dan cukup uang
- **Lelang:** Bid sampai 80% harga properti
- **Tidak pernah trade** (MVP — bisa ditambah nanti)
- **Penjara:** Bayar langsung jika punya uang

## Struktur File

```
game2/
├── server.js
├── package.json
├── public/
│   ├── index.html          # Landing page
│   ├── game.html           # Game board
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── lobby.js        # Landing page & room logic
│   │   ├── game.js         # Game loop, render, main controller
│   │   ├── board.js        # Papan 40 petak & render
│   │   ├── dice.js         # Animasi & logic dadu
│   │   ├── trade.js        # Trade UI & logic
│   │   ├── auction.js      # Lelang UI & logic
│   │   ├── chat.js         # Chat & activity log
│   │   └── sound.js        # Sound effects
│   ├── assets/
│   │   ├── images/         # Pion, rumah, hotel, ikon kota
│   │   └── sounds/         # SFX
│   └── data/
│       ├── properties.json # Data 40 petak
│       └── cards.json      # Kartu kesempatan & dana umum
└── game/
    ├── GameRoom.js         # State 1 room
    ├── Player.js           # Data pemain
    ├── Bot.js              # AI logic
    └── rules.js            # Validasi aturan
```

## Dependency

- `socket.io` — satu-satunya npm dependency
- Vanilla JS + CSS (no React/Vue/framework)
- No database

## Cara Jalankan

```bash
cd game2
npm install
node server.js
# Buka http://localhost:3000
```
