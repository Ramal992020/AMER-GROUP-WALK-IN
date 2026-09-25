#!/usr/bin/env node
/**
 * make-icons.mjs — يولّد كل أيقونات التطبيق من ملف اللوجو الفكتور (SVG).
 *
 * الاستخدام:
 *   node scripts/make-icons.mjs                      # لون العلامة من ملف الـ SVG
 *   node scripts/make-icons.mjs "#E30613"            # لون خلفية مختلف
 *   node scripts/make-icons.mjs "#EF0000" mark       # "mark" = كلمة AMER بس (بدون GROUP)
 *
 * مميزات إننا بنولّد من SVG بدل صورة:
 *   • جودة مثالية عند أي مقاس (فيكتور، مفيش بكسلنة أو حواف مسنّنة)
 *   • مفيش زوايا دائرية مطبوعة جوه الصورة (iOS/أندرويد بيعملوا الزوايا بنفسهم)
 *   • مفيش تدرّجات أو لمعة في الخلفية — لون العلامة بالظبط
 *
 * المخرجات في public/:
 *   icon-1024 · icon-512 · icon-192 · apple-touch-icon(180) · favicon-32
 *   favicon.ico · maskable-icon-512 (لأيقونة أندرويد التكيفية)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SVG_SRC = path.join(ROOT, "assets", "logo-amer-group.svg");

/** لون العلامة بيتقرأ من ملف الـ SVG نفسه => مصدر حقيقة واحد */
function brandColor() {
  const svg = fs.readFileSync(SVG_SRC, "utf8");
  const m = svg.match(/fill="#([0-9A-Fa-f]{6})"/);
  if (!m) throw new Error("مش لاقي لون الخلفية في ملف الـ SVG");
  return `#${m[1].toUpperCase()}`;
}

const BG = process.argv[2] || brandColor();
const VARIANT = process.argv[3] || "full"; // full | mark

/** نسبة عرض اللوجو من عرض الأيقونة */
const WIDTH_PCT = { normal: 92, maskable: 70 };

const OUT = path.join(ROOT, "public");

const MASTER = 1024;

const pct = (n, total) => Math.round((total * n) / 100);

/** يبني نسخة SVG بالخلفية الحمراء (زي الأصل) أو شفافة (للأيقونات) */
function buildSvg({ withBackground }) {
  let svg = fs.readFileSync(SVG_SRC, "utf8");
  if (!withBackground) {
    // شيل مستطيل الخلفية => اللوجو شفاف، والخلفية بنحطها إحنا
    svg = svg.replace(/\s*<rect[^>]*fill="#EF0000"[^>]*\/>/, "");
  }
  if (VARIANT === "mark") {
    // اقصّ الإطار على الجزء العلوي بس (كلمة AMER + السواش + النجمة)
    svg = svg.replace(
      /viewBox="[^"]*"/,
      'viewBox="773 440 697 200"'
    );
  }
  return svg;
}

/** يرندر اللوجو الشفاف بدقة عالية ويقصّه على حدوده الفعلية */
async function renderLogo() {
  const svg = buildSvg({ withBackground: false });
  const img = sharp(Buffer.from(svg), { density: 420 });
  // trim بيشيل أي فراغ شفاف حوالين الرسم
  return img.trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
}

/** يركّب اللوجو في منتصف مربع بلون الخلفية مع حشو */
async function composeSquare(logo, size, logoWidthPct) {
  const targetW = pct(logoWidthPct, size);
  const scaled = await sharp(logo)
    .resize({ width: targetW, fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: BG,
    },
  })
    .composite([{ input: scaled.data, gravity: "center" }])
    .removeAlpha() // sharp بيكتب RGBA دايمًا — الأيقونات لازم تكون بدون alpha
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

/** يحوّل buffer إلى .ico بأحجام متعددة */
async function buildIco(logo) {
  const sizes = [48, 32, 16];
  const pngs = [];
  for (const s of sizes) {
    const inner = await sharp(logo)
      .resize({ width: pct(WIDTH_PCT.normal, s), fit: "inside" })
      .toBuffer();
    pngs.push(
      await sharp({
        create: { width: s, height: s, channels: 3, background: BG },
      })
        .composite([{ input: inner, gravity: "center" }])
        .removeAlpha()
        .png()
        .toBuffer()
    );
  }

  // تركيب ملف ICO يدويًا (PNG-based، مدعوم في كل المتصفحات الحديثة)
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;
  for (let i = 0; i < count; i++) {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 0); // width
    e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 10);
    entries.push(e);
    offset += pngs[i].length;
  }

  return Buffer.concat([header, ...entries, ...pngs]);
}

function kb(buf) {
  return `${(buf.length / 1024).toFixed(0)}KB`;
}

async function main() {
  if (!fs.existsSync(SVG_SRC)) {
    console.error(`✗ ملف اللوجو غير موجود: ${SVG_SRC}`);
    process.exit(1);
  }

  console.log(`▸ اللوجو:       ${path.relative(ROOT, SVG_SRC)}`);
  console.log(`▸ النوع:        ${VARIANT === "mark" ? "كلمة AMER فقط" : "اللوجو كامل"}`);
  console.log(`▸ لون الخلفية:  ${BG}`);
  console.log(`▸ المخرجات:      ${path.relative(ROOT, OUT)}\n`);

  const { data: logo, info } = await renderLogo();
  console.log(`▸ اللوجو بعد القصّ: ${info.width}×${info.height} (نسبة ${(info.width / info.height).toFixed(2)}:1)`);

  const targets = [
    ["icon-1024.png", 1024, WIDTH_PCT.normal],
    ["icon-512.png", 512, WIDTH_PCT.normal],
    ["icon-192.png", 192, WIDTH_PCT.normal],
    ["apple-touch-icon.png", 180, WIDTH_PCT.normal],
    ["favicon-32.png", 32, WIDTH_PCT.normal],
    ["maskable-icon-512.png", 512, WIDTH_PCT.maskable],
  ];

  console.log("\n▸ الأيقونات:");
  for (const [name, size, widthPct] of targets) {
    const buf = await composeSquare(logo, size, widthPct);
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log(`  ✔ ${name.padEnd(24)} ${size}×${size}  (${kb(buf)})`);
  }

  const ico = await buildIco(logo);
  fs.writeFileSync(path.join(OUT, "favicon.ico"), ico);
  console.log(`  ✔ ${"favicon.ico".padEnd(24)} 16/32/48  (${kb(ico)})`);

  console.log(`\n✅ تم توليد ${targets.length + 1} ملف في ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => {
  console.error("✗ خطأ:", err.message);
  process.exit(1);
});
