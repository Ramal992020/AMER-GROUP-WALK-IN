# Amer Group | منظم الـ Walk-In

تطبيق ويب (React + Vite + TypeScript) لتنظيم الـ Walk-In بنظام **Head × Head** وأولوية الحضور.
التطبيق **ستاتيك بالكامل** — مفيش سيرفر، والمزامنة بين الأجهزة بتحصل مباشرة مع **Supabase** من المتصفح.

---

## 1) التشغيل المحلي

```bash
npm ci        # تثبيت الحزم
npm run dev   # تشغيل محلي على http://localhost:5173
npm run build # بناء نسخة الإنتاج داخل مجلد dist/
npm run preview
```

> ملاحظة: المشروع مبني بـ `vite-plugin-singlefile`، يعني ناتج البناء هو **ملف واحد** `dist/index.html`
> فيه كل الـ JS والـ CSS مدمجين — بجانبه ملفات الأيقونات و `manifest.json`.

---

## 2) النشر على Vercel

المشروع جاهز للنشر بدون أي تعديل، لأن ملف [`vercel.json`](./vercel.json) بيحدّد كل الإعدادات تلقائيًا:

| الإعداد | القيمة |
| --- | --- |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Rewrites | أي مسار غير موجود → `/index.html` |
| Cache | الصفحة الرئيسية `no-store` (لضمان وصول آخر نسخة)، والأيقونات كاش أسبوع |

### الطريقة (أ) — من لوحة Vercel (الأسهل، وبتنشر تلقائيًا مع كل تعديل)

1. افتح <https://vercel.com/new>.
2. اختار **Import Git Repository** وحدّد `Ramal992020/AMER-GROUP-WALK-IN`.
3. اضغط **Deploy** بدون تغيير أي إعداد (Vercel بيقرأ `vercel.json` لوحده).
4. الرابط هيبقى شكله: `https://amer-group-walk-in.vercel.app`.

بعد كده أي `push` على الفرع الرئيسي هيعمل نشر تلقائي، وأي Pull Request هيعمل **Preview Deployment** برابط منفصل.

### الطريقة (ب) — من سطر الأوامر (Vercel CLI)

```bash
npx vercel login          # تسجيل الدخول
npx vercel --prod         # نشر للإنتاج
```

---

## 3) بعد النشر — ضبط المزامنة على الأجهزة

بيانات المشروع (Project URL + Publishable Key) مبنية جوه `src/lib/sync.ts`، فكل جهاز محتاج خطوة واحدة:

1. افتح رابط التطبيق على الموبايل.
2. سجّل الدخول (SITE أو RESTA).
3. من **بطاقة الاتصال** اضغط **اختبار وحفظ الاتصال** مرة واحدة.

بعد كده البيانات بتتزامن تلقائيًا بين كل الأجهزة اللي داخلة بنفس الحساب.
لو الجدول مش موجود في Supabase، الحفظ هيعرضلك بلوك SQL جاهز للنسخ والتنفيذ مرة واحدة.

### تركيب التطبيق على الموبايل (PWA)

- **iPhone:** افتح الرابط في Safari → زر المشاركة → *Add to Home Screen*.
- **Android:** افتح الرابط في Chrome → القائمة → *Install app / إضافة إلى الشاشة الرئيسية*.

---

## 4) تحديث التطبيق بعد النشر

```bash
git add .
git commit -m "وصف التعديل"
git push
```

لو النشر مربوط بـ Git (الطريقة أ)، Vercel هيعمل build ونشر جديد لوحده في خلال دقيقة تقريبًا.
الملف `index.html` مضبوط على `Cache-Control: no-store` فالموبايل هيجيب آخر نسخة فورًا من غير ما يحتاج يمسح الكاش.
