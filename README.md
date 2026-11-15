# 🏝️ Monopoli Nusantara Online — 3D Realistic HD Edition

Game Monopoli bertema kota-kota dan landmark Indonesia, multiplayer real-time berbasis web dengan grafis **3D Realistic HD** (Three.js) dan fallback **2D Flat**.

Tanpa login — cukup masukkan nama, pilih pion tradisional Nusantara, buat atau gabung room via kode 6 karakter (`NUS-XXX`). Mendukung 2–4 pemain dengan opsi AI Bot mandiri.

---

## ✨ Fitur Utama

- **Papan Monopoli 3D Realistis (Three.js)**:
  - Meja dan papan kayu mahoni tebal dengan lis perimeter emas metalik (*gold trim*).
  - Karpet beludru biru (*center felt*) dengan ornamen kompas mawar angin dan lambang Monopoli Nusantara.
  - 40 Petak HD dengan tekstur kanvas prosedural resolusi tinggi.
  - Interaksi 3D Raycasting (hover glow dan klik petak untuk inspeksi properti).
- **Pion 3D Khas Nusantara**:
  - 🚲 **Becak**: Kabin penumpang berkanopi, jok kulit, 3 roda beruji, rangka krom.
  - ⛵ **Kapal Pinisi**: Lambung kayu jati, tiang ganda, layar tanja berkibar.
  - 🛺 **Bajaj**: Bodi oranye membulat, kaca depan, lampu depan krom, 3 roda karet.
  - 🦎 **Komodo**: Patung perunggu/giok antik dengan detail moncong, cakar, dan ekor melengkung.
  - Animasi gerak lompat parabola (*parabolic hopping*) per petak.
- **Bangunan 3D**:
  - 🏠 **Rumah 3D**: Bungalow hijau zamrud dengan atap genteng terakota dan cerobong.
  - 🏨 **Hotel 3D**: Menara hotel mewah merah rubi dengan atap penthouse emas.
- **Dadu 3D Fisik**:
  - Dadu gading/akrilik dengan efek lemparan berputar dan memantul di udara.
  - Efek ledakan cahaya emas saat melempar angka kembar (*Double*).
- **Kontrol Kamera Sinematik**:
  - Sudut 3D isometrik, tampak atas (*top-down*), fokus otomatis melacak pion, sudut dramatis, serta mode siang/malam.
  - OrbitControls bebas (rotasi, pan, zoom).
  - Tombol beralih mode tampilan: **3D HD** / **2D Flat**.
- **Mesin Aturan Monopoli Lengkap**:
  - Beli properti, bangun bertahap (aturan pemerataan rumah/hotel).
  - Sistem lelang otomatis (*auto-auction*) jika properti dilewati.
  - Sistem gadai (*mortgage* 50%) dan tebus (+10%).
  - Barter/Trade properti & uang antar pemain.
  - Sistem penjara (bayar, kartu bebas, atau coba lempar dadu ganda).
  - Kartu Kesempatan & Dana Umum dengan cita rasa lokal.
- **Autonomous AI Bot**:
  - AI Bot cerdas dengan kalkulasi modal cadangan, batas bid lelang, dan auto-roll.
- **Audio Sintesis Prosedural**:
  - Efek suara berbasis Web Audio API (0 KB file audio eksternal).

---

## 🚀 Cara Menjalankan

### Prasyarat
- [Node.js](https://nodejs.org/) (v16 ke atas)
- npm

### Instalasi & Menjalankan Server

```bash
# Clone repository
git clone https://github.com/MZLforDEX/monopoli.git
cd monopoli

# Install dependencies (hanya socket.io)
npm install

# Jalankan server
node server.js
```

Buka browser di **`http://localhost:3000`**.

---

## 📁 Struktur Proyek

```
monopoli/
├── server.js                # Server Node.js (HTTP + Socket.IO in-memory state)
├── package.json
├── docs/                    # Dokumentasi & Desain Spek
│   └── superpowers/specs/   # 2026-11-15-monopoli-nusantara-design.md
├── game/                    # Game Engine Backend
│   ├── GameRoom.js          # Room State & Turn Manager
│   ├── Player.js            # Model Pemain
│   ├── Bot.js               # Logika Keputusan AI Bot
│   └── rules.js             # Validasi Aturan & Kalkulasi Sewa
└── public/                  # Frontend Web
    ├── index.html           # Landing Page & Room Lobby
    ├── game.html            # Game Screen (3D Viewport & UI Overlay)
    ├── css/
    │   └── style.css        # Styling UI & Glassmorphism
    ├── data/
    │   ├── properties.json  # Data 40 Petak Nusantara
    │   └── cards.json       # Kartu Kesempatan & Dana Umum
    └── js/
        ├── libs/            # Three.js & OrbitControls
        ├── board3d.js       # Engine 3D Realistic HD Three.js
        ├── board.js         # Logika Papan & Sinkronisasi 2D/3D
        ├── dice.js          # Fallback Dadu 2D
        ├── game.js          # Controller Utama & Event Socket
        ├── lobby.js         # Logika Room Lobby
        ├── sound.js         # Synthesizer Web Audio API
        ├── trade.js         # Modal Barter/Trade
        ├── auction.js       # Modal Lelang
        └── chat.js          # Real-time Chat & Activity Log
```

---

## 📄 Lisensi

MIT License © 2026 Monopoli Nusantara
