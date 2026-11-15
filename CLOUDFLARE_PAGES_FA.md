# راهنمای انتشار Pi Brain روی Cloudflare Pages

## تنظیمات ساخت

- Framework preset: **React (Vite)** یا **None**
- Production branch: `main`
- Root directory: `/` (خالی یا پیش‌فرض)
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22` (فایل `.nvmrc` نیز در پروژه قرار دارد)

## متغیرهای محیطی (Build environment variables)

در Cloudflare Pages → Settings → Environment variables این متغیرها را برای Production تعریف کن:

| نام | مقدار |
|---|---|
| `VITE_SUPABASE_URL` | `https://athxpqwengfnbbyjqbnq.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | کلید عمومی `sb_publishable_...` پروژه Pi Brain |
| `VITE_PI_SANDBOX` | `true` |

این‌ها متغیرهای عمومی فرانت‌اند هستند؛ **هرگز** کلید Secret یا Service Role را با پیشوند `VITE_` قرار نده.

## مراحل انتشار با GitHub

1. فایل پروژه را از حالت ZIP خارج کن و محتویات پوشه `pi-brain-starter` را در ریشه یک مخزن GitHub قرار بده.
2. در Cloudflare Dashboard به **Workers & Pages** برو.
3. **Create application → Pages → Import an existing Git repository** را انتخاب کن.
4. مخزن Pi Brain و شاخه `main` را انتخاب کن.
5. تنظیمات ساخت بالا و متغیرهای محیطی را وارد کن و **Save and Deploy** را بزن.
6. پس از Deploy موفق، Cloudflare یک نشانی آزمایشی `*.pages.dev` می‌دهد.

## اتصال دامنه اختصاصی

1. در پروژه Pages به **Custom domains → Set up a domain** برو.
2. دامنه `pibrain.fileorganizercore.ir` را وارد کن.
3. اگر Cloudflare دامنه `fileorganizercore.ir` را همین‌جا مدیریت می‌کند، مراحل تأیید DNS را دنبال کن. در صورت درخواست، CNAME را دقیقاً طبق مقداری که داشبورد برای این Pages project نشان می‌دهد بساز.
4. تا زمانی که Pages دامنه را به پروژه وصل نکرده، CNAME را حدس نزن و دستی به مقصد فرضی اشاره نده.

## تنظیمات نهایی بک‌اند

پس از آن‌که دامنه HTTPS بالا آمد، در Supabase → Edge Functions → Secrets مقدار `APP_ALLOWED_ORIGIN` را برابر با مقدار دقیق زیر ثبت کن:

`https://pibrain.fileorganizercore.ir`

Secret سمت سرور (`OPENAI_API_KEY` و `PI_BRAIN_ADMIN_SECRET`) باید فقط در Supabase Secrets نگهداری شود و در Cloudflare Pages variables یا کد مرورگر قرار نگیرد.

## نکته‌های مهم

- `.env.local` در مخزن قرار نمی‌گیرد؛ `.gitignore` آن را مستثنا کرده است.
- Cloudflare Pages هر بار که روی شاخه Production commit جدیدی قرار بگیرد، سایت را مجدداً build و منتشر می‌کند.
- ساخت و انتشار کامل در این محیط هنوز Build-test نشده؛ نصب npm در محیط فعلی به پایان نرسید. نتیجه نهایی باید از Cloudflare build logs تأیید شود.
