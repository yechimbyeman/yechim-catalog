# YECHIM Catalog — GitHub Pages + Supabase production package

## Architecture
- **Client site:** GitHub Pages, root URL.
- **Dashboard:** GitHub Pages at `/dashboard/` with Supabase Auth.
- **Data source:** Eman.uz → daily GitHub Actions sync at 05:00 Asia/Tashkent.
- **Eman fields:** SKU, name, price, base brand/category, main image, source URL and parsed source attributes.
- **YECHIM fields:** publication status, YECHIM brand, description, custom specs, mounting scheme image, additional images, badge, discount percentage, sort order.
- **No stock is exposed in the YECHIM catalog.**
- **No PDF field is used.**
- **YECHIM LIGHTING** is the presentation label for Eman's `Мебельная подсветка` group.

## 1. Create Supabase project
Create a free Supabase project and open SQL Editor. Run the full `supabase.sql` file.

Then in Supabase Authentication:
- disable public sign-ups;
- create the dashboard user(s) manually;
- use email/password authentication.

Copy the project's URL and anon key into `supabase-config.js`:

```js
window.YECHIM_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  telegramManagerUsername: 'YOUR_MANAGER_USERNAME'
};
```

The anon key is intended for browser use. **Never put the Supabase service-role key in `supabase-config.js` or any client-side file.**

## 2. Create GitHub repository
Create a repository and push this project to the `main` branch.

## 3. Add GitHub Secrets
Repository → Settings → Secrets and variables → Actions → New repository secret:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is used only inside the GitHub Actions sync job.

## 4. Enable GitHub Pages
Repository → Settings → Pages → Source: **GitHub Actions**.

The Pages workflow publishes:
- client catalog: `/`
- dashboard: `/dashboard/`

GitHub will display the exact public Pages URL after the first deployment.

## 5. First sync
Run Actions → **YECHIM daily Eman sync** → Run workflow.

The workflow discovers the current Eman catalog group links from the Russian Eman homepage, follows pagination, reads product cards and detail pages, and upserts the selected brands into `eman_products`.

The workflow does **not** change `yechim_enrichment`, so your dashboard edits survive every sync.

## 6. Dashboard workflow
1. Open `/dashboard/`.
2. Sign in with the Supabase user you created.
3. Find a product.
4. Add YECHIM brand, description, specs, mounting scheme, extra images and optional discount percentage.
5. Turn on **Показывать в каталоге**.
6. Save.

Only published products are returned to the public client site via the `get_public_catalog()` RPC function.

## Important production behavior
- Price and source product information come from Eman and are refreshed daily.
- If a product is not published in Dashboard, it is invisible to customers.
- Customer-side cart is stored in the customer's browser.
- `Отправить заявку` prepares the SKU/quantity list for the configured Telegram manager.
- Stock/availability is intentionally not shown.


## YECHIM E-Catalog update (November 2026)

1. In Supabase SQL Editor, run `supabase-update.sql` once. This adds the discount field and updates the public catalogue RPC.
2. Deploy `supabase/functions/trigger-price-sync/index.ts` as the Edge Function `trigger-price-sync` (JWT verification must remain enabled).
3. Set these Edge Function secrets:
   - `GITHUB_TOKEN`: fine-grained GitHub token with Actions: Read and write permission for this repository.
   - `GITHUB_REPOSITORY`: `OWNER/REPOSITORY`.
   - `GITHUB_WORKFLOW_FILE`: `sync.yml` (optional; this is the default).
4. The scheduled sync runs daily at 00:00 UTC, which is 05:00 in Tashkent (Asia/Tashkent). GitHub Actions schedules can start a little later during busy periods.
5. Brand pages show all products with 24 products per page. Social links are configured in `index.html`.

Do not place `GITHUB_TOKEN` in any browser-side file or commit it to the repository.

## Eman product descriptions and characteristics

The daily synchronizer now also attempts to extract the product description and key/value characteristics from each Eman product page. These source fields are stored inside `eman_products.extra` (`eman_description` and `eman_specs`) and refreshed on every sync. If Eman does not publish a description or characteristics for a product, the corresponding source block stays empty.

In the Dashboard, Eman description and characteristics are shown as read-only source information. You can add a YECHIM description supplement and additional Russian characteristics, one `Name: value` pair per line. The public catalog combines Eman's characteristics first and YECHIM's additions after them. Uzbek characteristics remain separately editable in the Uzbek field.

After deploying these changes, run the `YECHIM daily Eman sync` GitHub Actions workflow once manually so the existing products are enriched with the newly extracted source fields. The regular scheduled sync runs at 05:00 Asia/Tashkent.
