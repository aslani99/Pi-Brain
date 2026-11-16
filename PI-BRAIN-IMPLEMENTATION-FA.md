# Pi Brain — آماده‌سازی پیاده‌سازی آزمون مرحله‌ای

این تغییرات در نسخهٔ محلی پروژه آماده شده‌اند. **هیچ Migration روی Supabase اجرا نشده و هیچ Edge Functionی Deploy نشده است.** اجرای دستورات تغییردهندهٔ دیتابیس فقط پس از تأیید صریح مالک پروژه مجاز است.

## فایل‌های اصلی تغییرکرده

- `supabase/migrations/20261116120000_per_user_question_history.sql` نسخهٔ اصلی موجود در ZIP شماست و حفظ شده است.
- `supabase/migrations/20261116194500_staged_quiz_paths_and_delivery.sql` Migration تکمیلی جدید برای تاریخچهٔ قابل‌اعتماد، رزرو موقت، مسیرهای مستقل، مرحله و دشواری، تخصیص اتمیک، ثبت پاسخ و فهرست پویای دسته‌هاست.
- `supabase/functions/start-quiz/` شروع آزمون با دادهٔ واقعی Backend و تحویل سؤال اول.
- `supabase/functions/next-question/` تحویل مرحله‌ای سؤال بعدی.
- `supabase/functions/quiz-catalog/` فهرست دسته‌های تأییدشده و پیشرفت هر مسیر.
- `supabase/functions/submit-answer/` از RPC جدید `record_quiz_answer` استفاده می‌کند.
- `supabase/functions/generate-questions/` تولید تا ۲۰۰ پیش‌نویس با پنج سطح دشواری و کنترل تکرار.
- `src/services/backend.ts` و `src/App.tsx` برای API جدید، انتخاب مسیر، مرحله، دشواری و دریافت مرحله‌ای سؤال‌ها هماهنگ شده‌اند.
- `supabase/tests/quiz_progress.sql` سناریوهای پایه را در تراکنش Rollback‌شونده بررسی می‌کند.

## اعمال Patch روی نسخهٔ فعلی شما

Patch تحویلی نسبت به وضعیت دقیق ZIP ارسالی شما ساخته شده است؛ یعنی تغییرات قبلی ثبت‌نشدهٔ خود پروژه را دوباره وارد نمی‌کند. در یک کپی پشتیبان از همان نسخهٔ ZIP و در ریشهٔ مخزن:

```bash
git apply --check Pi-Brain-staged-quiz-implementation.patch
git apply Pi-Brain-staged-quiz-implementation.patch
```

اگر به‌جای Patch از ZIP کامل پروژهٔ به‌روزشده استفاده می‌کنید، Patch را دوباره روی آن اعمال نکنید.

## روند محلی

در پوشهٔ اصلی پروژه:

```bash
pnpm install --frozen-lockfile
pnpm build
```

## بررسی وضعیت Migrationها — فقط خواندنی

ابتدا به پروژهٔ درست متصل شوید و وضعیت فایل‌های محلی و Supabase را مقایسه کنید:

```bash
supabase login
supabase link --project-ref athxpqwengfnbbyjqbnq
supabase migration list --linked
```

Migration تکمیلی باید پس از `20261116120000_per_user_question_history.sql` اعمال شود. فایل قدیمی را با فایل جدید جایگزین نکنید. اگر نسخهٔ قبلی Migration روی Supabase اجرا شده باشد، نسخهٔ جدید با شناسهٔ جداگانه همچنان باید در فهرست Pending دیده شود.

**فقط پس از بازبینی SQL، تهیهٔ Backup و تأیید صریح مالک پروژه** دستور زیر Migrationهای Pending را روی پروژهٔ متصل اجرا می‌کند:

```bash
supabase db push --linked
```

این دستور در این بسته اجرا نشده است.

## Deploy توابع — پس از اعمال موفق Migration و تأیید مالک

```bash
supabase functions deploy start-quiz --project-ref athxpqwengfnbbyjqbnq
supabase functions deploy next-question --project-ref athxpqwengfnbbyjqbnq
supabase functions deploy quiz-catalog --project-ref athxpqwengfnbbyjqbnq
supabase functions deploy submit-answer --project-ref athxpqwengfnbbyjqbnq
supabase functions deploy generate-questions --project-ref athxpqwengfnbbyjqbnq
```

پیش از Deploy مطمئن شوید Secretهای موردنیاز موجودند؛ از جمله `SUPABASE_URL`، کلید محرمانهٔ سمت سرور (`SUPABASE_SERVICE_ROLE_KEY` یا `SUPABASE_SECRET_KEY`)، تنظیمات احراز هویت Pi و برای تولید سؤال `OPENAI_API_KEY` و `PI_BRAIN_ADMIN_SECRET`. هیچ Secretی نباید در Frontend یا Git قرار گیرد.

## تست دیتابیس

`supabase/tests/quiz_progress.sql` را فقط روی دیتابیس آزمایشی/غیر Production اجرا کنید. کل اسکریپت داخل `BEGIN` اجرا می‌شود و در پایان `ROLLBACK` می‌کند. تست‌های آن مرزهای فرمول تعداد سؤال، سطح دشواری، ارتقای مرحله پس از پنج پاسخ، استقلال مسیر تصادفی، نگه‌داشتن تاریخچهٔ آزمون نیمه‌کاره، و غیرقابل‌بازی‌بودن دسته‌ای که فقط سؤال Draft دارد را بررسی می‌کنند.

## محدودیت‌ها و مواردی که هنوز نیازمند تأیید عملی‌اند

- در محیط این آماده‌سازی `pnpm`، وابستگی‌های نصب‌شده، Deno و PostgreSQL محلی در دسترس نبودند؛ بنابراین Build واقعی Vite، اجرای Edge Functionها و اجرای SQL در PostgreSQL انجام نشد.
- بررسی TypeScript رابط کاربری با declarationهای موقت انجام شد و بدون خطا بود؛ این جایگزین Build واقعی با وابستگی‌های پروژه نیست.
- Migration تاریخچهٔ قابل‌اثبات را از سؤال اول نشست‌های قدیمی و پاسخ‌های ثبت‌شده Backfill می‌کند. مرحله/دستهٔ تاریخی را نمی‌توان از نشست‌های قدیمی با اطمینان بازسازی کرد، چون آن داده‌ها در Schema پیشین ذخیره نشده بودند؛ مسیرهای جدید پس از مهاجرت از Stage 1 آغاز می‌شوند.
- تشخیص شباهت متنی با fingerprint و جست‌وجوی trigram انجام می‌شود؛ تشخیص قطعی تکرار معنایی/موضوعی همچنان به بازبینی انسانی نیاز دارد.
- قبل از اعمال روی پروژهٔ واقعی، وضعیت Migrationهای ثبت‌شده، نسخهٔ Supabase، Secrets و نام دقیق ستون‌ها/Schema باید با پروژهٔ متصل تطبیق داده شود.
