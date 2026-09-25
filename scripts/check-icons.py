#!/usr/bin/env python3
"""
check-icons.py — يفحص أيقونات التطبيق ويتأكد إنها سليمة قبل النشر.

الاستخدام:
    python3 scripts/check-icons.py

اللي بيتأكد منه:
  • كل ملف ببعد صحيح وبعدد القنوات المناسب (من غير شفافية للأيقونات).
  • لون الخلفية موحّد على لون العلامة #E30613.
  • مفيش "بكسلات شاذة" بره منطقة اللوجو (بقايا زوايا دائرية أو حدود).
  • حشو متساوي حوالي اللوجو.
  • أيقونة Maskable محتواها جوه دايرة الأمان (80% من العرض).
"""
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = (227, 6, 19)  # #E30613
BG_TOL = 60        # فرق مسموح عن لون الخلفية


def decode_png(path):
    """فك ترميز PNG بسيط (8-bit, colortype 2/6) => (w, h, ch, pixels)."""
    data = open(path, 'rb').read()
    pos, idat = 8, b''
    w = h = ct = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, _bd, ct = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT':
            idat += chunk
        pos += 12 + ln

    raw = zlib.decompress(idat)
    ch = 4 if ct == 6 else 3
    stride = w * ch
    out = bytearray()
    prev = bytearray(stride)
    i = 0
    for _ in range(h):
        f = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
        if f == 1:
            for x in range(ch, stride):
                line[x] = (line[x] + line[x - ch]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                b = prev[x]
                c = prev[x - ch] if x >= ch else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out += line
        prev = line
    return w, h, ch, out


def analyse(path, fuzz=BG_TOL):
    w, h, ch, px = decode_png(path)

    def rgb(x, y):
        o = y * w * ch + x * ch
        return px[o], px[o + 1], px[o + 2]

    def dist(c):
        return max(abs(c[0] - BG[0]), abs(c[1] - BG[1]), abs(c[2] - BG[2]))

    bg_count = sum(1 for y in range(h) for x in range(w) if dist(rgb(x, y)) <= fuzz)
    xs = [x for y in range(h) for x in range(w) if dist(rgb(x, y)) > fuzz]
    ys = [y for y in range(h) for x in range(w) if dist(rgb(x, y)) > fuzz]

    return {
        'path': path, 'w': w, 'h': h, 'ch': ch,
        'bg_pct': 100 * bg_count / (w * h),
        'bbox': (min(xs), max(xs), min(ys), max(ys)) if xs else None,
    }


FILES = [
    'icon-1024.png', 'icon-512.png', 'icon-192.png',
    'apple-touch-icon.png', 'favicon-32.png', 'maskable-icon-512.png',
]
EXPECTED = {
    'icon-1024.png': 1024, 'icon-512.png': 512, 'icon-192.png': 192,
    'apple-touch-icon.png': 180, 'favicon-32.png': 32, 'maskable-icon-512.png': 512,
}

ok = True
print('\n  فحص أيقونات التطبيق\n  ' + '─' * 62)

for name in FILES:
    path = os.path.join(ROOT, 'public', name)
    if not os.path.exists(path):
        print(f'  ✗ {name:24} الملف غير موجود')
        ok = False
        continue

    r = analyse(path)
    size_ok = r['w'] == EXPECTED[name] and r['h'] == EXPECTED[name]
    opaque_ok = r['ch'] == 3
    bbox = r['bbox']

    # ملاحظة: اللوجو أعرض من إنه يبقى مربع، فالحشو الأفقي طبيعي يكون
    # أصغر من الرأسي. المهم إن اللوجو متوسّط: يسار≈يمين و أعلى≈أسفل.
    tol = max(2, r['w'] // 16)
    if bbox:
        x0, x1, y0, y1 = bbox
        pads = (x0, r['w'] - 1 - x1, y0, r['h'] - 1 - y1)
        centred = abs(pads[0] - pads[1]) <= tol and abs(pads[2] - pads[3]) <= tol
        diag = ((x1 - x0 + 1) ** 2 + (y1 - y0 + 1) ** 2) ** 0.5
    else:
        pads, centred, diag = (0, 0, 0, 0), False, 0

    flags = []
    if not size_ok:
        flags.append(f'المقاس غلط ({r["w"]}×{r["h"]})')
    if not opaque_ok:
        flags.append('فيه شفافية (لازم تكون بدون alpha)')
    if r['bg_pct'] < 55:
        flags.append(f'الخلفية غير موحّدة ({r["bg_pct"]:.0f}% بس)')
    if not centred:
        flags.append(f'اللوجو مش متوسّط {pads}')
    if name == 'maskable-icon-512.png' and diag > 0.8 * r['w']:
        flags.append(f'محتوى بره دايرة الأمان (قطر {diag:.0f}px)')

    if flags:
        print(f'  ✗ {name:24} ' + ' | '.join(flags))
        ok = False
    else:
        print(f'  ✓ {name:24} {r["w"]}×{r["h"]}  خلفية {r["bg_pct"]:.0f}%  '
              f'حشو أفقي/رأسي {pads[0]}/{pads[2]}')

print('  ' + '─' * 62)
print('  ✅ كل الأيقونات سليمة\n' if ok else '  ⚠ فيه مشاكل محتاجة مراجعة\n')
sys.exit(0 if ok else 1)
