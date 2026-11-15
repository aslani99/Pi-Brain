# راه‌اندازی Pi Brain — نسخه متصل به Supabase

## وضعیت فعلی پروژه

پروژه مستقل Supabase ساخته شده و زیرساخت بک‌اند آن روی حساب شما مستقر شده است.

| مورد | مقدار |
|---|---|
| نام پروژه | `Pi Brain` |
| Project Reference | `athxpqwengfnbbyjqbnq` |
| منطقه | Frankfurt / `eu-central-1` |
| آدرس API | `https://athxpqwengfnbbyjqbnq.supabase.co` |
| کلید فرانت‌اند | Publishable Key (در `.env.local` همین بسته قرار داده شده) |
| وضعیت دیتابیس | فعال و سالم |

پروژه `FileOrganizerCore-Testnet` طبق درخواست متوقف شده است. پروژه `FileOrganizerCore-Mainnet` فعال مانده و تغییری نکرده است.

**توجه:** توقف پروژه Supabase با نام `FileOrganizerCore-Testnet` به معنی خاموش‌کردن Pi Network Sandbox نیست. این‌ها دو سرویس جداگانه‌اند. برای تست اپ Pi همچنان می‌توانی یک اپ Testnet/Sandbox را در Pi Developer Portal ثبت کنی.

## چه چیزهایی از قبل آماده شده‌اند؟

- چهار جدول `profiles`، `questions`، `quiz_sessions` و `quiz_attempts` ایجاد شده‌اند.
- RLS روی هر چهار جدول فعال است و برای نقش‌های مرورگر سیاست منع دسترسی مستقیم تعریف شده است.
- چهار جدول فقط از سمت توابع سرور و با کلید محرمانه Supabase قابل دسترسی‌اند؛ هیچ کلید محرمانه‌ای در فرانت‌اند قرار نگرفته است.
- ثبت پاسخ، محاسبه XP و جلوگیری از دریافت دوباره امتیاز در دیتابیس انجام می‌شود.
- پنج Edge Function مستقر و فعال‌اند: `pi-auth`، `start-quiz`، `submit-answer`، `leaderboard` و `generate-questions`.
- توابع ورود، آزمون، پاسخ و رتبه‌بندی، access token را با Pi Platform API بررسی می‌کنند.
- کنترل تکراری‌بودن سؤال‌ها از طریق fingerprint دقیق و تشابه متنی انجام می‌شود.
- هشت سؤال نمونه در جدول وجود دارد؛ همه در وضعیت `draft` هستند و هنوز قابل ارائه در آزمون سروری نیستند.

آدرس داشبورد پروژه: https://supabase.com/dashboard/project/athxpqwengfnbbyjqbnq

## ۱ — اجرای رابط Pi Brain روی رایانه

فایل `.env.local` از قبل با URL پروژه و کلید عمومی آماده شده است؛ آن را تغییر نده. این کلید Publishable مخصوص استفاده در برنامه مرورگری است. کلیدهای `Secret` و `service_role` را هرگز در فایل‌های دارای پیشوند `VITE_` نگذار.

۱. بسته را از حالت فشرده خارج کن.
۲. Node.js نسخه ۲۰ یا جدیدتر را نصب کن.
۳. در پوشه پروژه، CMD یا Terminal را باز کن و اجرا کن:

```bash
npm install
npm run dev
```

آدرس محلی معمولاً `http://localhost:5173` است. برای توقف برنامه، در همان پنجره `Ctrl+C` بزن.

نکته فنی: در این محیط نتوانستم نصب کامل وابستگی‌های npm و اجرای مرورگری را به‌طور کامل آزمایش کنم؛ بنابراین این مرحله هنوز تست نهایی سیستم روی رایانه تو محسوب نمی‌شود.

## ۲ — افزودن اسرار موردنیاز به Supabase

صفحه Secrets پروژه را باز کن:

https://supabase.com/dashboard/project/athxpqwengfnbbyjqbnq/functions/secrets

در بخش Edge Functions → Secrets، این مقادیر را با دکمه افزودن Secret ثبت کن:

| نام Secret | مقدار |
|---|---|
| `OPENAI_API_KEY` | کلید API حساب OpenAI خودت؛ فقط برای تولید سؤال لازم است |
| `PI_BRAIN_ADMIN_SECRET` | یک رمز تصادفی طولانی که فقط نزد مدیر بماند |

برای ساخت رمز مدیریتی تصادفی در CMD ویندوز (پس از نصب Node.js) این دستور را اجرا کن:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

خروجی را در Secret با نام `PI_BRAIN_ADMIN_SECRET` قرار بده. آن را در چت، فایل `.env.local` یا کد فرانت‌اند نگذار.

`OPENAI_API_KEY` را فقط در صورتی اضافه کن که حساب و کلید API فعال داری. هیچ کلیدی را در این گفتگو ارسال نکن. مقدار `OPENAI_MODEL` اختیاری است و در صورت نبودن از مقدار پیش‌فرض تابع استفاده می‌شود.

Supabase خودش `SUPABASE_URL` و کلید سروری پیش‌فرض را به محیط Edge Functions تزریق می‌کند. کد Pi Brain هم قالب جدید `SUPABASE_SECRET_KEYS` و متغیر قدیمی `SUPABASE_SERVICE_ROLE_KEY` را پشتیبانی می‌کند؛ این موارد رزروشده را دستی نساز.

## ۳ — ثبت اپ Pi در Sandbox/Testnet

این کار از داخل حساب Pi خودت انجام می‌شود و به Supabase مربوط نیست.

۱. وارد Pi Developer Portal شو: https://develop.pinet.com
۲. یک اپ جداگانه برای محیط Development/Testnet ثبت کن و نام آن را `Pi Brain` بگذار.
۳. برای تست محلی، Development URL را روی `http://localhost:5173` قرار بده.
۴. اپ را در Pi Browser یا Pi Sandbox باز کن و فرآیند مجازسازی Sandbox را از راهنمای رسمی Pi کامل کن.
۵. مقدار `VITE_PI_SANDBOX=true` در `.env.local` برای همین محیط تنظیم شده است.
۶. تست ورود باید داخل Pi Browser یا Sandbox انجام شود؛ مرورگر عادی رایانه به‌تنهایی Pi SDK را فراهم نمی‌کند.

برای انتشار Mainnet، ثبت/پیکربندی جداگانه و آدرس میزبانی‌شده لازم است. تا زمانی که آن ثبت جداگانه انجام نشده، مقدار Sandbox را تغییر نده.

راهنمای رسمی Pi:
- https://developers.minepi.com/docs/build-first-app/GettingStarted
- https://developers.minepi.com/docs/authenticate-user/Authentication
- https://developers.minepi.com/docs/build-first-app/Sandbox
- https://developers.minepi.com/docs/build-first-app/RegisterApp

## ۴ — آماده‌سازی سؤال‌های قابل بازی

در Supabase → Table Editor → `questions`، هشت سؤال نمونه را می‌بینی. همگی `draft` هستند. پیش از انتشار، متن سؤال، گزینه‌ها، پاسخ صحیح، توضیح و منبع معتبر هر مورد باید توسط ویراستار انسانی بررسی شود.

فقط پس از تأیید صحت و منبع، `review_status` را به `approved` تغییر بده. تابع `start-quiz` فقط سؤال‌های `approved` را برمی‌گرداند و عمداً پاسخ صحیح را پیش از ثبت پاسخ به مرورگر نمی‌فرستد.

## ۵ — تولید سؤال جدید با هوش مصنوعی

پس از ثبت `OPENAI_API_KEY` و `PI_BRAIN_ADMIN_SECRET` در Secrets، تابع `generate-questions` می‌تواند پیش‌نویس بسازد. این تابع با هدر مدیریتی `x-pi-admin-secret` محافظت می‌شود؛ آن را از سمت مرورگر عمومی صدا نزن.

هر سؤال تازه با وضعیت `draft` ذخیره می‌شود. سیستم تکرار دقیق و سؤال‌های خیلی مشابه را بررسی می‌کند؛ با این حال تشابه معنایی و صحت واقعیت‌ها نیازمند کنترل انسانی است. AI به‌تنهایی مجوز انتشار یا تأیید حقیقت نیست.

## ۶ — میزبانی عمومی و CORS

در حال حاضر برنامه هنوز روی دامنه HTTPS عمومی میزبانی نشده است. پس از انتخاب هاست و انتشار نسخه وب، Origin دقیق آن را به‌عنوان Secret با نام `APP_ALLOWED_ORIGIN` اضافه کن؛ برای مثال `https://app.example.com` را فقط با دامنه واقعی خودت جایگزین کن. تا آن زمان لازم نیست مقداری برای آن ثبت کنی.

## ۷ — مواردی که هنوز تکمیل نشده‌اند

- نصب وابستگی‌ها و اجرای کامل پروژه روی رایانه تو.
- افزودن کلیدهای `OPENAI_API_KEY` و `PI_BRAIN_ADMIN_SECRET` در داشبورد Supabase.
- ثبت و تأیید اپ Pi در Developer Portal و تست واقعی ورود در Pi Browser/Sandbox.
- بازبینی انسانی و انتشار سؤال‌های اولیه و ترجمه‌های معتبر.
- میزبانی HTTPS عمومی، ثبت Origin دقیق و آماده‌سازی نسخه Mainnet.
- پنل مدیریت داخلی، سامانه ضدتقلب پیشرفته و کنترل نرخ درخواست‌ها.
- اتصال Pi Ad Network؛ این اتصال نیازمند شرایط و تأیید جداگانه Pi است و هنوز فعال نیست.

## امنیت

- توکن Pi فقط در حافظه نشست مرورگر نگهداری می‌شود، نه در `localStorage`.
- هویت Pi در سرور بررسی می‌شود؛ اطلاعات کاربر برگشتی از مرورگر برای احراز هویت کافی دانسته نمی‌شود.
- پاسخ صحیح و محاسبه XP سمت سرور انجام می‌شوند.
- دسترسی مستقیم نقش‌های مرورگر به جداول خصوصی مسدود است.
- کلیدهای Secret و `service_role` هرگز نباید در مرورگر، فایل `.env.local` یا مخزن کد قرار بگیرند.
