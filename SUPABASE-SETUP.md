# Setup Supabase Ulakasha

1. In Supabase apri `SQL Editor` e lancia il contenuto di `supabase-schema.sql`.
2. In `Project Settings > API` copia:
   - Project URL
   - anon public key
3. Inseriscili in `supabase-config.js`:

```js
window.ULAKASHA_SUPABASE_URL = "https://xxxx.supabase.co";
window.ULAKASHA_SUPABASE_ANON_KEY = "ey...";
```

4. Per ricevere la notifica email newsletter, configura le variabili ambiente server-side su Netlify:

```txt
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=contact@ulakasha.com
CONTACT_NOTIFICATION_EMAIL=...
```

Il formulario newsletter invia i dati alla Netlify Function `/.netlify/functions/newsletter`.
La function salva ogni iscrizione nella tabella `newsletter_subscribers` e invia la notifica email tramite Resend.

5. Per usare `admin.html`:
   - in Supabase vai su `Authentication > Users`;
   - crea un utente email/password per chi gestirà i prodotti;
   - apri `admin.html`, accedi e crea i prodotti.

Le immagini vengono caricate nel bucket pubblico `product-images`.

## Categorie prodotti

Quando inserisci i prodotti direttamente in Supabase, usa questi valori nel campo `categoria`:

- `abbigliamento`
- `accessorio-tessile`
- `bijoux`
- `tessile`
- `tavola`
- `bottiglia`
- `tazze`
- `arte`

Nel campo `foto` puoi inserire più Public URL: lo shop li mostrerà come carosello.

Se la tabella `products` esiste già, aggiungi il campo per i dettagli del CMS con:

```sql
alter table public.products
add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.products
add column if not exists details_labels jsonb not null default '{}'::jsonb;
```

## Campi inviati dal formulario newsletter

```json
{
  "name": "...",
  "email": "...",
  "phone": "...",
  "newsletter_language": "it",
  "site_language": "it",
  "message": "...",
  "source": "website",
  "page_url": "https://...",
  "consent": true
}
```
