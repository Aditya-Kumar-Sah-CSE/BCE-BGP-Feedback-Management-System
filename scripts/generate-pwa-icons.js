const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table & calculation for standard PNG chunk checksums
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPNG(width, height, pixelFn) {
  // 1. Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // 2. IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Non-interlaced

  const ihdrChunk = createChunk('IHDR', ihdr);

  // 3. Raw Scanline Data (width * 4 bytes + 1 filter byte per line)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  // 4. IDAT Chunk (zlib compressed)
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // 5. IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Institutional BCE Crest Pixel Renderer
 * Navy: #0B192C (11, 25, 44)
 * Cobalt: #1E3E62 (30, 62, 98)
 * Gold/Amber: #F59E0B (245, 158, 11)
 * Bright Gold: #FBBF24 (251, 191, 36)
 * White: #FFFFFF
 */
function renderBceIcon(isMaskable) {
  return function(x, y, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Margin scale: maskable has 10% outer safe margin
    const scale = isMaskable ? 0.76 : 0.92;
    const radius = (w / 2) * scale;

    // Outer background: Navy #0B192C
    let r = 11, g = 25, b = 44, a = 255;

    // Radial gradient glow towards center (Cobalt #1E3E62)
    const glowFactor = Math.max(0, 1 - (dist / (w * 0.55)));
    r = Math.min(255, Math.round(11 + (30 - 11) * glowFactor * 1.5));
    g = Math.min(255, Math.round(25 + (62 - 25) * glowFactor * 1.5));
    b = Math.min(255, Math.round(44 + (98 - 44) * glowFactor * 1.5));

    // Outer Circle Ring (Gold border)
    const ringThickness = Math.max(2, Math.round(w * 0.022));
    if (Math.abs(dist - radius) <= ringThickness) {
      return [245, 158, 11, 255]; // Amber gold ring
    }

    if (dist < radius - ringThickness * 2) {
      // Inner Circle background subtle highlight
      const innerGlow = Math.max(0, 1 - (dist / radius));
      r = Math.round(16 + 25 * innerGlow);
      g = Math.round(32 + 45 * innerGlow);
      b = Math.round(58 + 65 * innerGlow);
    }

    // Draw Shield contour inside
    const nx = dx / (radius * 0.72);
    const ny = (dy + radius * 0.08) / (radius * 0.75); // slight vertical offset

    // Shield shape boundary: |nx| <= 1 for ny between -0.8 and 0.2, then tapering to point at ny = 1.0
    let inShield = false;
    let onShieldBorder = false;
    const shieldBorderWidth = 0.07;

    if (ny >= -0.85 && ny <= 0.2) {
      const bound = 0.85;
      const d = Math.abs(nx) - bound;
      if (d <= 0) inShield = true;
      if (Math.abs(d) < shieldBorderWidth) onShieldBorder = true;
    } else if (ny > 0.2 && ny <= 1.0) {
      // Parabolic taper to bottom point
      const progress = (ny - 0.2) / 0.8;
      const bound = 0.85 * (1 - Math.pow(progress, 1.3));
      const d = Math.abs(nx) - bound;
      if (d <= 0) inShield = true;
      if (Math.abs(d) < shieldBorderWidth) onShieldBorder = true;
    }

    // Top horizontal shield border
    if (Math.abs(ny - (-0.85)) < shieldBorderWidth && Math.abs(nx) <= 0.85) {
      onShieldBorder = true;
    }

    if (onShieldBorder) {
      return [251, 191, 36, 255]; // Bright Gold
    }

    if (inShield) {
      // Shield interior gradient
      r = 15; g = 32; b = 58;

      // Draw Mortarboard / Academic Cap Symbol in upper half of shield
      // Diamond base: |nx| / 0.55 + |ny + 0.35| / 0.22 <= 1
      const capX = nx;
      const capY = ny + 0.32;
      const diamondDist = Math.abs(capX) / 0.52 + Math.abs(capY) / 0.18;

      if (diamondDist <= 1.0) {
        // Gold Mortarboard top
        return [245, 158, 11, 255];
      }

      // Skullcap underneath mortarboard
      if (capY >= 0.08 && capY <= 0.28 && Math.abs(capX) <= 0.30) {
        return [217, 119, 6, 255]; // Warm amber shade
      }

      // Tassel dangling to right
      if (capX >= 0.38 && capX <= 0.44 && capY >= -0.02 && capY <= 0.35) {
        return [254, 240, 138, 255]; // Soft light gold tassel
      }

      // University Ribbon / Chevron in lower shield
      const chevronY = ny - 0.42;
      const chevronDist = Math.abs(chevronY + Math.abs(nx) * 0.35);
      if (chevronDist <= 0.08 && Math.abs(nx) <= 0.55 && ny < 0.8) {
        return [245, 158, 11, 255];
      }
    }

    // Outside boundary for non-maskable icons (rounded square transparent corners if desired, or solid dark background)
    if (!isMaskable) {
      // Keep square with sleek dark theme background for standard PWA splash
      return [r, g, b, 255];
    }

    return [r, g, b, 255];
  };
}

const publicDir = path.join(__dirname, '..', 'public');

console.log('Generating PWA icons in:', publicDir);

// 1. icon-192.png
const icon192 = createPNG(192, 192, renderBceIcon(false));
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
console.log('✓ Created public/icon-192.png');

// 2. icon-512.png
const icon512 = createPNG(512, 512, renderBceIcon(false));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
console.log('✓ Created public/icon-512.png');

// 3. icon-maskable.png (512x512 with safe padding)
const iconMaskable = createPNG(512, 512, renderBceIcon(true));
fs.writeFileSync(path.join(publicDir, 'icon-maskable.png'), iconMaskable);
console.log('✓ Created public/icon-maskable.png');

// 4. apple-touch-icon.png (180x180 for iOS)
const appleIcon = createPNG(180, 180, renderBceIcon(false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);
console.log('✓ Created public/apple-touch-icon.png');

// 5. favicon.ico (standard 32x32)
const favicon = createPNG(32, 32, renderBceIcon(false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon);
console.log('✓ Created public/favicon.ico');

console.log('All PWA icons generated successfully.');
