/**
 * Monopoli Nusantara — Iconic City & Tile Landmark Artwork Engine
 * Provides bespoke procedural vector illustrations for all 40 tiles (cities, airports, utilities, taxes, cards, and corners)
 * used on the 3D board textures, 2D board grid tiles, Title Deed Cards, Buy Modals, and Auction Modals.
 */

const NusantaraLandmarks = {
  cache: new Map(),

  metadata: {
    0:  { shortName: 'START',        title: 'Gapura Agung Nusantara',          sky: ['#064e3b', '#0f766e'] },
    1:  { shortName: 'Banda Aceh',   title: 'Masjid Raya Baiturrahman',        sky: ['#1e1b4b', '#4338ca'] },
    2:  { shortName: 'Dana Umum',    title: 'Peti Pusaka Nusantara',           sky: ['#0c4a6e', '#0284c7'] },
    3:  { shortName: 'Sabang',       title: 'Tugu Nol Kilometer RI',           sky: ['#0f172a', '#0369a1'] },
    4:  { shortName: 'Pajak Hasil',  title: 'Gedung Kas & Perpajakan',         sky: ['#450a0a', '#991b1b'] },
    5:  { shortName: 'Soetta',       title: 'Bandara Soekarno-Hatta',          sky: ['#0c4a6e', '#0369a1'] },
    6:  { shortName: 'Medan',        title: 'Istana Maimun Kesultanan Deli',   sky: ['#14532d', '#15803d'] },
    7:  { shortName: 'Kesempatan',   title: 'Kompas Keberuntungan',            sky: ['#451a03', '#b45309'] },
    8:  { shortName: 'Padang',       title: 'Rumah Gadang Minangkabau',        sky: ['#3b0764', '#7e22ce'] },
    9:  { shortName: 'Bukittinggi',  title: 'Jam Gadang & Ngarai Sianok',      sky: ['#1e293b', '#3b82f6'] },
    10: { shortName: 'Penjara',      title: 'Benteng Tahanan Nusantara',       sky: ['#18181b', '#3f3f46'] },
    11: { shortName: 'Palembang',    title: 'Jembatan Ampera Sungai Musi',     sky: ['#31102f', '#9d174d'] },
    12: { shortName: 'PLN',          title: 'Menara Transmisi SUTET PLN',      sky: ['#1e1b4b', '#ca8a04'] },
    13: { shortName: 'Lampung',      title: 'Menara Siger Bakauheni',          sky: ['#3b0764', '#6d28d9'] },
    14: { shortName: 'Bengkulu',     title: 'Benteng Marlborough & Rafflesia', sky: ['#4c0519', '#be123c'] },
    15: { shortName: 'Juanda',       title: 'Bandara Internasional Juanda',    sky: ['#082f49', '#0284c7'] },
    16: { shortName: 'Jakarta',      title: 'Monumen Nasional (Monas)',        sky: ['#431407', '#ea580c'] },
    17: { shortName: 'Dana Umum',    title: 'Peti Pusaka Nusantara',           sky: ['#0c4a6e', '#0284c7'] },
    18: { shortName: 'Bogor',        title: 'Istana Kepresidenan & Kujang',    sky: ['#064e3b', '#059669'] },
    19: { shortName: 'Tangerang',    title: 'Masjid Raya Al-Azhom',            sky: ['#1e3a8a', '#2563eb'] },
    20: { shortName: 'Parkir Bebas', title: 'Pendopo Taman Istirahat',         sky: ['#064e3b', '#0d9488'] },
    21: { shortName: 'Bandung',      title: 'Gedung Sate Jawa Barat',          sky: ['#450a0a', '#dc2626'] },
    22: { shortName: 'Kesempatan',   title: 'Kompas Keberuntungan',            sky: ['#451a03', '#b45309'] },
    23: { shortName: 'Yogyakarta',   title: 'Tugu Jogja & Candi Prambanan',    sky: ['#4c0519', '#e11d48'] },
    24: { shortName: 'Semarang',     title: 'Lawang Sewu & Tugu Muda',         sky: ['#3b0764', '#9333ea'] },
    25: { shortName: 'Ngurah Rai',   title: 'Bandara Internasional Ngurah Rai',sky: ['#431407', '#d97706'] },
    26: { shortName: 'Surabaya',     title: 'Patung Sura dan Baya',            sky: ['#064e3b', '#047857'] },
    27: { shortName: 'Malang',       title: 'Tugu Malang & Gunung Bromo',      sky: ['#1e1b4b', '#d97706'] },
    28: { shortName: 'PDAM',         title: 'Bendungan & Menara Tirta PDAM',   sky: ['#083344', '#0891b2'] },
    29: { shortName: 'Denpasar',     title: 'Pura Tanah Lot & Candi Bentar',   sky: ['#7c2d12', '#f59e0b'] },
    30: { shortName: 'Ke Penjara',   title: 'Perintah Penahanan',              sky: ['#450a0a', '#ef4444'] },
    31: { shortName: 'Makassar',     title: 'Kapal Pinisi Pantai Losari',      sky: ['#1e3a8a', '#d97706'] },
    32: { shortName: 'Manado',       title: 'Taman Laut Bunaken & Jembatan',   sky: ['#064e3b', '#0284c7'] },
    33: { shortName: 'Dana Umum',    title: 'Peti Pusaka Nusantara',           sky: ['#0c4a6e', '#0284c7'] },
    34: { shortName: 'Balikpapan',   title: 'Garuda Nusantara & Teluk',        sky: ['#064e3b', '#10b981'] },
    35: { shortName: 'Hasanuddin',   title: 'Bandara Sultan Hasanuddin',       sky: ['#0c4a6e', '#0284c7'] },
    36: { shortName: 'Kesempatan',   title: 'Kompas Keberuntungan',            sky: ['#451a03', '#b45309'] },
    37: { shortName: 'Jayapura',     title: 'Jembatan Merah Youtefa',          sky: ['#0f172a', '#0284c7'] },
    38: { shortName: 'Pajak Bumi',   title: 'Kas Agraria & Pajak Bumi',        sky: ['#3f2312', '#b45309'] },
    39: { shortName: 'Raja Ampat',   title: 'Kepulauan Karst Wayag & Piaynemo',sky: ['#042f2e', '#06b6d4'] }
  },

  getMeta(tile) {
    if (!tile) return { shortName: '-', title: 'Nusantara', sky: ['#0f172a', '#1e293b'] };
    return this.metadata[tile.id] || {
      shortName: tile.name.length > 11 ? tile.name.slice(0, 10) + '…' : tile.name,
      title: tile.name,
      sky: ['#0f172a', '#1e293b']
    };
  },

  getDataUrl(tile, w = 400, h = 240) {
    if (!tile) return '';
    const key = `${tile.id}:${w}x${h}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    this.drawLandmarkOnCanvas(ctx, tile, 0, 0, w, h, false);
    const url = canvas.toDataURL('image/png');
    this.cache.set(key, url);
    return url;
  },

  drawLandmarkOnCanvas(ctx, tile, x, y, w, h, drawBorder = true) {
    const meta = this.getMeta(tile);
    ctx.save();

    // Clip to rounded rectangle
    const r = Math.min(14, w * 0.06, h * 0.1);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.clip();

    // Sky Backdrop Gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, meta.sky[0]);
    grad.addColorStop(1, meta.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Subtle sun/moon glow in sky
    const sunGrad = ctx.createRadialGradient(x + w * 0.72, y + h * 0.28, w * 0.02, x + w * 0.72, y + h * 0.28, w * 0.35);
    sunGrad.addColorStop(0, 'rgba(253, 224, 71, 0.38)');
    sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(x, y, w, h);

    // Normalize coordinate space to 200 x 140 for crisp scalable vector drawing
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(w / 200, h / 140);

    this.drawVectorScene(ctx, tile);

    ctx.restore();

    if (drawBorder) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)';
      ctx.lineWidth = Math.max(2, w * 0.012);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x + 1, y + 1, w - 2, h - 2, r);
      } else {
        ctx.rect(x + 1, y + 1, w - 2, h - 2);
      }
      ctx.stroke();
    }

    ctx.restore();
  },

  drawVectorScene(ctx, tile) {
    const id = tile ? tile.id : 0;

    // Helper for water waves at bottom
    const drawWaves = (yStart, color1 = '#0284c7', color2 = '#38bdf8') => {
      ctx.fillStyle = color1;
      ctx.fillRect(0, yStart, 200, 140 - yStart);
      ctx.strokeStyle = color2;
      ctx.lineWidth = 2.5;
      for (let row = 0; row < 2; row++) {
        const wy = yStart + 10 + row * 12;
        ctx.beginPath();
        for (let wx = 15; wx <= 185; wx += 28) {
          ctx.moveTo(wx, wy);
          ctx.quadraticCurveTo(wx + 7, wy - 4, wx + 14, wy);
          ctx.quadraticCurveTo(wx + 21, wy + 4, wx + 28, wy);
        }
        ctx.stroke();
      }
    };

    // Helper for ground horizon
    const drawGround = (yStart, color = '#065f46') => {
      ctx.fillStyle = color;
      ctx.fillRect(0, yStart, 200, 140 - yStart);
    };

    switch (id) {
      case 0: {
        // START: Gapura Candi Bentar Nusantara + Rising Sun
        ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.beginPath();
        ctx.arc(100, 95, 46, Math.PI, 0);
        ctx.fill();
        drawGround(112, '#064e3b');
        // Left & Right Candi Bentar split gate towers
        ctx.fillStyle = '#f59e0b';
        const drawGateHalf = (gx, dir) => {
          for (let step = 0; step < 6; step++) {
            const sw = 26 - step * 3.5;
            const sh = 12;
            const sx = dir === -1 ? gx - sw : gx;
            ctx.fillRect(sx, 112 - (step + 1) * sh, sw, sh - 1);
          }
        };
        drawGateHalf(76, -1);
        drawGateHalf(124, 1);
        // Red & White Flag Ribbon across center
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(76, 66, 48, 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(76, 73, 48, 7);
        break;
      }

      case 1: {
        // Banda Aceh: Masjid Raya Baiturrahman (White arches & 3 iconic black domes)
        drawGround(110, '#065f46');
        // Reflecting pool
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(35, 116, 130, 16);
        // White mosque main wall
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(28, 72, 144, 38);
        // Arches
        ctx.fillStyle = '#1e293b';
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(46 + i * 27, 110, 8, Math.PI, 0);
          ctx.fill();
        }
        // 3 Charcoal-black onion domes
        const drawDome = (dx, dy, r) => {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(dx, dy, r, Math.PI, 0);
          ctx.lineTo(dx + r, dy + 6);
          ctx.lineTo(dx - r, dy + 6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(dx, dy - r);
          ctx.lineTo(dx, dy - r - 11);
          ctx.stroke();
        };
        drawDome(54, 68, 17);
        drawDome(100, 62, 23);
        drawDome(146, 68, 17);
        break;
      }

      case 3: {
        // Sabang: Tugu Nol Kilometer Indonesia
        drawWaves(108, '#0369a1', '#7dd3fc');
        // Cliff base
        ctx.fillStyle = '#334155';
        ctx.fillRect(55, 100, 90, 14);
        // Twin white curved pillars
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(76, 46, 12, 54);
        ctx.fillRect(112, 46, 12, 54);
        // Circular rings at top
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(64, 42, 72, 9);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(72, 32, 56, 10);
        // Garuda Spire
        ctx.beginPath();
        ctx.moveTo(100, 14);
        ctx.lineTo(116, 32);
        ctx.lineTo(84, 32);
        ctx.closePath();
        ctx.fill();
        // "0 KM" label
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 15px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('0 KM', 100, 80);
        break;
      }

      case 6: {
        // Medan: Istana Maimun (Royal Yellow Malay Deli Palace)
        drawGround(110, '#15803d');
        // Main yellow palace body
        ctx.fillStyle = '#facc15';
        ctx.fillRect(26, 68, 148, 42);
        // Green trim & arches
        ctx.fillStyle = '#166534';
        ctx.fillRect(26, 68, 148, 6);
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(46 + i * 27, 110, 9, Math.PI, 0);
          ctx.fill();
        }
        // Central & side royal domes
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(74, 68);
        ctx.quadraticCurveTo(100, 26, 126, 68);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(98, 22, 4, 14);
        break;
      }

      case 8: {
        // Padang: Rumah Gadang Minangkabau (Curved Buffalo-Horn Gonjong Roofs)
        drawGround(112, '#14532d');
        // Stilt house body
        ctx.fillStyle = '#b45309';
        ctx.fillRect(42, 76, 116, 28);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(46, 82, 108, 6);
        // Curved Gonjong horns roof
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(20, 32);
        ctx.quadraticCurveTo(48, 78, 68, 52);
        ctx.quadraticCurveTo(84, 72, 100, 24);
        ctx.quadraticCurveTo(116, 72, 132, 52);
        ctx.quadraticCurveTo(152, 78, 180, 32);
        ctx.lineTo(158, 78);
        ctx.lineTo(42, 78);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 9: {
        // Bukittinggi: Jam Gadang Clock Tower
        // Mountain backdrop
        ctx.fillStyle = 'rgba(30, 58, 138, 0.65)';
        ctx.beginPath();
        ctx.moveTo(10, 115);
        ctx.lineTo(65, 55);
        ctx.lineTo(130, 115);
        ctx.fill();
        drawGround(114, '#166534');
        // White tower shaft
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(80, 38, 40, 76);
        // Clock circle
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(100, 58, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(100, 58, 10, 0, Math.PI * 2);
        ctx.fill();
        // Clock hands
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(100, 58); ctx.lineTo(100, 51);
        ctx.moveTo(100, 58); ctx.lineTo(106, 58);
        ctx.stroke();
        // Minang Gonjong roof on top of Jam Gadang
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(70, 20);
        ctx.quadraticCurveTo(100, 44, 130, 20);
        ctx.lineTo(123, 40);
        ctx.lineTo(77, 40);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 11: {
        // Palembang: Jembatan Ampera (Iconic Red Twin Lifting Towers over Musi River)
        drawWaves(104, '#0369a1', '#38bdf8');
        ctx.strokeStyle = '#ef4444';
        ctx.fillStyle = '#dc2626';
        // Bridge deck
        ctx.fillRect(10, 84, 180, 7);
        // Left & Right Red Towers
        ctx.fillRect(52, 24, 14, 82);
        ctx.fillRect(134, 24, 14, 82);
        // Top crossbeam
        ctx.fillRect(48, 28, 104, 7);
        // Suspension cables
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(52, 32); ctx.lineTo(14, 84);
        ctx.moveTo(66, 32); ctx.lineTo(95, 84);
        ctx.moveTo(134, 32); ctx.lineTo(105, 84);
        ctx.moveTo(148, 32); ctx.lineTo(186, 84);
        ctx.stroke();
        break;
      }

      case 13: {
        // Lampung: Menara Siger (Golden Crown Monument)
        drawWaves(114, '#0284c7', '#7dd3fc');
        // Green coastal hill
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(100, 135, 75, Math.PI, 0);
        ctx.fill();
        // Red base pedestal
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(48, 86, 104, 12);
        // Golden Siger Crown with 9 spires
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(42, 86);
        const peaks = [
          [50, 58], [62, 48], [75, 38], [88, 28],
          [100, 16],
          [112, 28], [125, 38], [138, 48], [150, 58]
        ];
        peaks.forEach(([px, py]) => {
          ctx.lineTo(px, py);
          ctx.lineTo(px + 5, 72);
        });
        ctx.lineTo(158, 86);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 14: {
        // Bengkulu: Bunga Rafflesia Arnoldii & Benteng Marlborough
        drawGround(106, '#14532d');
        // Fort battlements in background
        ctx.fillStyle = '#64748b';
        ctx.fillRect(24, 62, 152, 44);
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(28 + i * 26, 52, 14, 12);
        }
        // Giant Red Rafflesia Flower in foreground
        const cx = 100, cy = 88;
        ctx.fillStyle = '#e11d48';
        for (let a = 0; a < 5; a++) {
          const ang = (a * Math.PI * 2) / 5 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * 22, cy + Math.sin(ang) * 18, 17, 0, Math.PI * 2);
          ctx.fill();
          // White spots
          ctx.fillStyle = '#fecdd3';
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * 24, cy + Math.sin(ang) * 20, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e11d48';
        }
        ctx.fillStyle = '#881337';
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      }

      case 16: {
        // Jakarta: Monumen Nasional (Monas) & Skyline
        drawGround(114, '#1e293b');
        // Background skyscrapers
        ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.fillRect(28, 64, 22, 50);
        ctx.fillRect(56, 76, 18, 38);
        ctx.fillRect(130, 70, 20, 44);
        ctx.fillRect(154, 58, 22, 56);
        // Monas Base Cup (Cawan)
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(64, 92);
        ctx.lineTo(136, 92);
        ctx.lineTo(122, 108);
        ctx.lineTo(78, 108);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(72, 108, 56, 8);
        // Obelisk Tower
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(93, 34);
        ctx.lineTo(107, 34);
        ctx.lineTo(111, 92);
        ctx.lineTo(89, 92);
        ctx.closePath();
        ctx.fill();
        // Top viewing platform & Golden Flame (Lidah Api)
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(88, 30, 24, 5);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(100, 10);
        ctx.quadraticCurveTo(112, 22, 100, 30);
        ctx.quadraticCurveTo(88, 22, 100, 10);
        ctx.fill();
        break;
      }

      case 18: {
        // Bogor: Istana Bogor & Tugu Kujang
        drawGround(108, '#15803d');
        // White Presidential Palace with Columns & Dome
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(30, 72, 140, 36);
        ctx.beginPath();
        ctx.arc(100, 72, 26, Math.PI, 0);
        ctx.fill();
        // Columns
        ctx.fillStyle = '#cbd5e1';
        for (let c = 0; c < 6; c++) {
          ctx.fillRect(40 + c * 22, 76, 5, 32);
        }
        // Golden Kujang emblem in foreground
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(100, 22);
        ctx.quadraticCurveTo(116, 40, 104, 62);
        ctx.lineTo(96, 62);
        ctx.quadraticCurveTo(88, 42, 100, 22);
        ctx.fill();
        break;
      }

      case 19: {
        // Tangerang: Masjid Raya Al-Azhom (5 Overlapping Sky-Blue Domes)
        drawGround(112, '#0f172a');
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(34, 80, 132, 32);
        // 4 surrounding blue domes + 1 large central blue dome
        const drawBlueDome = (dx, dy, r) => {
          ctx.fillStyle = '#38bdf8';
          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(dx, dy, r, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Gold spire
          ctx.strokeStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(dx, dy - r);
          ctx.lineTo(dx, dy - r - 9);
          ctx.stroke();
        };
        drawBlueDome(58, 80, 22);
        drawBlueDome(142, 80, 22);
        drawBlueDome(100, 76, 34);
        break;
      }

      case 21: {
        // Bandung: Gedung Sate (White Heritage Building + 6-Satay Skewer Pinnacle)
        drawGround(112, '#166534');
        // Main neoclassical white facade
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(28, 72, 144, 40);
        // Terracotta roof
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(22, 72);
        ctx.lineTo(44, 54);
        ctx.lineTo(156, 54);
        ctx.lineTo(178, 72);
        ctx.closePath();
        ctx.fill();
        // Central tiered tower
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(82, 40, 36, 34);
        // Iconic 6-ball "Tusuk Sate" spire
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(100, 10);
        ctx.lineTo(100, 40);
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        for (let b = 0; b < 6; b++) {
          ctx.beginPath();
          ctx.arc(100, 14 + b * 4.2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 23: {
        // Yogyakarta: Tugu Pal Putih & Candi Prambanan Silhouette
        drawGround(112, '#3f2312');
        // Prambanan temple silhouettes in background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        const drawCandi = (cx, topY, baseW) => {
          ctx.beginPath();
          ctx.moveTo(cx, topY);
          ctx.lineTo(cx + baseW / 2, 112);
          ctx.lineTo(cx - baseW / 2, 112);
          ctx.closePath();
          ctx.fill();
        };
        drawCandi(54, 42, 34);
        drawCandi(146, 42, 34);
        // Tugu Jogja (White & Gold Monument) in center foreground
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(86, 86, 28, 26);
        ctx.fillRect(91, 52, 18, 34);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(84, 84, 32, 4);
        ctx.fillRect(89, 50, 22, 4);
        ctx.beginPath();
        ctx.moveTo(100, 18);
        ctx.lineTo(108, 50);
        ctx.lineTo(92, 50);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 24: {
        // Semarang: Lawang Sewu (Twin Colonial Towers & Arched Galleries)
        drawGround(112, '#1e293b');
        // Central gallery with many arches (1000 doors)
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(52, 66, 96, 46);
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(48, 66); ctx.lineTo(65, 48); ctx.lineTo(135, 48); ctx.lineTo(152, 66);
        ctx.fill();
        // Twin Octagonal Towers on Left & Right
        const drawTower = (tx) => {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(tx - 16, 48, 32, 64);
          ctx.fillStyle = '#b91c1c';
          ctx.beginPath();
          ctx.arc(tx, 48, 17, Math.PI, 0);
          ctx.fill();
        };
        drawTower(38);
        drawTower(162);
        // Arches row
        ctx.fillStyle = '#334155';
        for (let a = 0; a < 5; a++) {
          ctx.fillRect(62 + a * 16, 76, 9, 14);
          ctx.fillRect(62 + a * 16, 95, 9, 17);
        }
        break;
      }

      case 26: {
        // Surabaya: Patung Sura dan Baya & Suramadu
        drawWaves(108, '#047857', '#34d399');
        // Pedestal
        ctx.fillStyle = '#475569';
        ctx.fillRect(72, 92, 56, 20);
        // Dynamic Sura (Shark - Silver/Blue) & Baya (Crocodile - Emerald/Gold) curving arc
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        // Shark arc (left)
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(92, 58, 28, Math.PI * 0.65, Math.PI * 1.65);
        ctx.stroke();
        // Crocodile arc (right)
        ctx.strokeStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(108, 58, 28, -Math.PI * 0.35, Math.PI * 0.65);
        ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }

      case 27: {
        // Malang: Tugu Malang & Gunung Bromo Volcano
        // Bromo & Semeru Volcanoes in background
        ctx.fillStyle = '#312e81';
        ctx.beginPath();
        ctx.moveTo(10, 112); ctx.lineTo(68, 44); ctx.lineTo(118, 112);
        ctx.fill();
        ctx.fillStyle = '#4338ca';
        ctx.beginPath();
        ctx.moveTo(82, 112); ctx.lineTo(132, 56); ctx.lineTo(156, 56); ctx.lineTo(192, 112);
        ctx.fill();
        // Volcanic smoke puff from Bromo crater
        ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
        ctx.beginPath();
        ctx.arc(144, 44, 12, 0, Math.PI * 2);
        ctx.arc(154, 34, 15, 0, Math.PI * 2);
        ctx.fill();
        drawGround(110, '#065f46');
        // Tugu Malang white spire in lotus pond
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(58, 112, 84, 14);
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(100, 26); ctx.lineTo(110, 112); ctx.lineTo(90, 112);
        ctx.fill();
        break;
      }

      case 29: {
        // Denpasar: Pura Tanah Lot Multi-Tiered Meru Pagoda at Sunset
        // Big glowing Bali sunset disc
        ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.beginPath();
        ctx.arc(100, 74, 42, 0, Math.PI * 2);
        ctx.fill();
        drawWaves(104, '#1e3a8a', '#fbbf24');
        // Ocean rock formation
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.moveTo(45, 108);
        ctx.quadraticCurveTo(100, 76, 155, 108);
        ctx.fill();
        // 5-Tiered Balinese Meru Pagoda Roofs
        ctx.fillStyle = '#18181b';
        for (let t = 0; t < 5; t++) {
          const rw = 64 - t * 10;
          const ry = 82 - t * 13;
          ctx.beginPath();
          ctx.moveTo(100 - rw / 2, ry);
          ctx.lineTo(100 + rw / 2, ry);
          ctx.lineTo(100 + (rw - 12) / 2, ry - 8);
          ctx.lineTo(100 - (rw - 12) / 2, ry - 8);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case 31: {
        // Makassar: Kapal Pinisi Pantai Losari
        drawWaves(104, '#0c4a6e', '#38bdf8');
        // Wooden Pinisi Hull
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.moveTo(38, 86);
        ctx.lineTo(166, 80);
        ctx.lineTo(142, 106);
        ctx.lineTo(54, 106);
        ctx.closePath();
        ctx.fill();
        // Twin Masts & Iconic Pinisi Sails
        ctx.fillStyle = '#fef3c7';
        // Main sails
        ctx.beginPath();
        ctx.moveTo(82, 24); ctx.lineTo(82, 82); ctx.lineTo(48, 80);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(86, 26); ctx.lineTo(118, 80); ctx.lineTo(86, 82);
        ctx.fill();
        // Fore sails
        ctx.beginPath();
        ctx.moveTo(124, 34); ctx.lineTo(158, 76); ctx.lineTo(124, 80);
        ctx.fill();
        break;
      }

      case 32: {
        // Manado: Pulau Bunaken & Jembatan Soekarno
        // Cone of Manado Tua island
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.moveTo(20, 102);
        ctx.quadraticCurveTo(70, 32, 125, 102);
        ctx.fill();
        drawWaves(100, '#0284c7', '#22d3ee');
        // Cable-stayed bridge arch on right
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(145, 42); ctx.lineTo(145, 100);
        ctx.moveTo(145, 46); ctx.lineTo(110, 92);
        ctx.moveTo(145, 46); ctx.lineTo(185, 92);
        ctx.stroke();
        break;
      }

      case 34: {
        // Balikpapan: Sayap Garuda Nusantara & Teluk
        drawWaves(108, '#064e3b', '#34d399');
        // Soaring Bronze/Gold Garuda Wings Silhouette
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(100, 86);
        ctx.quadraticCurveTo(55, 78, 18, 34);
        ctx.quadraticCurveTo(58, 48, 92, 62);
        ctx.lineTo(100, 26);
        ctx.lineTo(108, 62);
        ctx.quadraticCurveTo(142, 48, 182, 34);
        ctx.quadraticCurveTo(145, 78, 100, 86);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(72, 86, 56, 22);
        break;
      }

      case 37: {
        // Jayapura: Jembatan Merah Youtefa (Twin Crimson Steel Tied-Arches)
        // Green hills of Jayapura
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.arc(45, 108, 50, Math.PI, 0);
        ctx.arc(160, 108, 45, Math.PI, 0);
        ctx.fill();
        drawWaves(102, '#0284c7', '#38bdf8');
        // Twin Crimson Red Arches
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(70, 92, 36, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(136, 92, 36, Math.PI, 0);
        ctx.stroke();
        // Vertical suspender cables & bridge deck
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fca5a5';
        for (let cx = 42; cx <= 164; cx += 12) {
          ctx.beginPath();
          ctx.moveTo(cx, 68);
          ctx.lineTo(cx, 92);
          ctx.stroke();
        }
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(16, 90, 168, 6);
        break;
      }

      case 39: {
        // Raja Ampat: Kepulauan Karst Wayag & Piaynemo Lagoon
        drawWaves(96, '#0891b2', '#67e8f9');
        // Iconic Emerald Karst Islets rising from turquoise lagoon
        const drawKarst = (kx, ky, kw, kh, color) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(kx - kw * 0.42, ky);
          ctx.quadraticCurveTo(kx - kw * 0.55, ky - kh * 0.65, kx, ky - kh);
          ctx.quadraticCurveTo(kx + kw * 0.55, ky - kh * 0.65, kx + kw * 0.42, ky);
          ctx.closePath();
          ctx.fill();
          // Sandy base rim
          ctx.fillStyle = '#fde68a';
          ctx.fillRect(kx - kw * 0.42, ky - 3, kw * 0.84, 3);
        };
        drawKarst(46, 100, 44, 48, '#047857');
        drawKarst(152, 102, 48, 52, '#065f46');
        drawKarst(100, 106, 56, 68, '#10b981');
        break;
      }

      case 5:
      case 15:
      case 25:
      case 35: {
        // National Airports (Soetta, Juanda, Ngurah Rai, Hasanuddin)
        drawGround(110, '#1e293b');
        // Runway perspective stripes
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(25, 120, 30, 4);
        ctx.fillRect(85, 120, 30, 4);
        ctx.fillRect(145, 120, 30, 4);
        // Control Tower on left
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(36, 54, 12, 56);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(30, 42, 24, 12);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(28, 38, 28, 4);
        // Ascending Jet Airplane silhouette
        ctx.save();
        ctx.translate(118, 58);
        ctx.rotate(-0.28);
        ctx.fillStyle = '#f8fafc';
        // Fuselage
        ctx.beginPath();
        ctx.roundRect(-42, -7, 84, 14, 7);
        ctx.fill();
        // Swept Wings
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-6, -6); ctx.lineTo(-24, -34); ctx.lineTo(-12, -34); ctx.lineTo(12, -6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-6, 6); ctx.lineTo(-24, 34); ctx.lineTo(-12, 34); ctx.lineTo(12, 6);
        ctx.fill();
        // Tail fin
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-32, -6); ctx.lineTo(-44, -24); ctx.lineTo(-34, -24); ctx.lineTo(-22, -6);
        ctx.fill();
        ctx.restore();
        break;
      }

      case 12: {
        // PLN: Menara Transmisi SUTET & Petir Listrik
        drawGround(114, '#1e293b');
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 3;
        // Steel lattice tower
        ctx.beginPath();
        ctx.moveTo(58, 114); ctx.lineTo(74, 28); ctx.lineTo(90, 114);
        ctx.moveTo(52, 48); ctx.lineTo(96, 48);
        ctx.moveTo(46, 70); ctx.lineTo(102, 70);
        ctx.stroke();
        // Giant Golden Lightning Bolt
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(142, 18);
        ctx.lineTo(108, 68);
        ctx.lineTo(132, 68);
        ctx.lineTo(116, 116);
        ctx.lineTo(160, 58);
        ctx.lineTo(134, 58);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 28: {
        // PDAM: Bendungan & Kristal Air Tirta
        drawWaves(102, '#0284c7', '#67e8f9');
        // Dam structure
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(26, 56, 54, 48);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(38, 66, 30, 38);
        // Large Glowing Water Droplet
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(134, 24);
        ctx.quadraticCurveTo(168, 68, 156, 88);
        ctx.arc(134, 84, 24, 0.2, Math.PI - 0.2);
        ctx.quadraticCurveTo(100, 68, 134, 24);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 2:
      case 17:
      case 33: {
        // Dana Umum: Peti Pusaka Kas Nusantara & Koin Emas
        drawGround(112, '#082f49');
        // Treasure Chest base
        ctx.fillStyle = '#92400e';
        ctx.fillRect(52, 56, 96, 52);
        // Gold bands & lockplate
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(52, 56, 96, 8);
        ctx.fillRect(52, 100, 96, 8);
        ctx.fillRect(60, 48, 12, 60);
        ctx.fillRect(128, 48, 12, 60);
        ctx.fillRect(90, 52, 20, 22);
        // Glowing Gold Coins on top
        ctx.fillStyle = '#fde047';
        for (let c = 0; c < 5; c++) {
          ctx.beginPath();
          ctx.arc(72 + c * 14, 48 - (c % 2) * 5, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 7:
      case 22:
      case 36: {
        // Kesempatan: Kompas Bintang Keberuntungan & Tanda Tanya Emas
        // Starburst rays
        ctx.save();
        ctx.translate(100, 70);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-10, -56);
          ctx.lineTo(10, -56);
          ctx.closePath();
          ctx.fill();
          ctx.rotate(Math.PI / 4);
        }
        // Golden medallion
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 52px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 3);
        ctx.restore();
        break;
      }

      case 4:
      case 38: {
        // Pajak Penghasilan & Pajak Bumi: Gedung Kas Negara & Koin
        drawGround(112, '#1e293b');
        ctx.fillStyle = '#e2e8f0';
        // Pediment roof
        ctx.beginPath();
        ctx.moveTo(38, 52); ctx.lineTo(100, 20); ctx.lineTo(162, 52);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(44, 52, 112, 8);
        ctx.fillRect(40, 102, 120, 10);
        // 4 Pillars
        for (let p = 0; p < 4; p++) {
          ctx.fillRect(54 + p * 27, 60, 10, 42);
        }
        // Gold Coin Badge
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(146, 86, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.font = '900 18px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Rp', 146, 87);
        break;
      }

      case 10: {
        // Penjara (Kunjungan): Jeruji Besi & Gembok Baja
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(36, 20, 128, 100);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 6;
        ctx.strokeRect(36, 20, 128, 100);
        for (let b = 1; b <= 4; b++) {
          ctx.beginPath();
          ctx.moveTo(36 + b * 25.6, 20);
          ctx.lineTo(36 + b * 25.6, 120);
          ctx.stroke();
        }
        // Golden Padlock in center
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(100, 62, 12, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(82, 62, 36, 30);
        break;
      }

      case 20: {
        // Parkir Bebas: Pendopo Taman Tropis & Mobil Istirahat
        drawGround(108, '#065f46');
        // Joglo Pendopo Roof
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(34, 68); ctx.lineTo(74, 34); ctx.lineTo(126, 34); ctx.lineTo(166, 68);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(52, 68, 8, 40);
        ctx.fillRect(140, 68, 8, 40);
        // Parked Red Touring Car
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(68, 86, 64, 16);
        ctx.fillRect(80, 74, 40, 14);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(82, 104, 8, 0, Math.PI * 2);
        ctx.arc(118, 104, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 30:
      default: {
        // Masuk Penjara: Sirine Patroli Polisi Merah-Biru
        drawGround(112, '#1e293b');
        // Lightbar base
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(44, 84, 112, 16);
        // Red Siren Dome (Left)
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(76, 84, 24, Math.PI, 0);
        ctx.fill();
        // Blue Siren Dome (Right)
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(124, 84, 24, Math.PI, 0);
        ctx.fill();
        // Flashing light rays
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3.5;
        const rays = [[52, 42, 36, 24], [76, 36, 76, 18], [124, 36, 124, 18], [148, 42, 164, 24]];
        rays.forEach(([x1, y1, x2, y2]) => {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        });
        break;
      }
    }
  }
};

window.NusantaraLandmarks = NusantaraLandmarks;
