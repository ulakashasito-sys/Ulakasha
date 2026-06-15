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

4. Per ricevere una notifica email con Make:
   - crea uno scenario Make con trigger `Custom webhook`;
   - copia l'URL del webhook;
   - incollalo in `supabase-config.js`:

```js
window.ULAKASHA_MAKE_NEWSLETTER_WEBHOOK_URL = "https://hook.eu2.make.com/...";
```

Il sito salverà ogni iscrizione nella tabella `newsletter_subscribers` e invierà lo stesso payload a Make.

5. Per usare `admin.html`:
   - in Supabase vai su `Authentication > Users`;
   - crea un utente email/password per chi gestirà i prodotti;
   - apri `admin.html`, accedi e crea i prodotti.

Le immagini vengono caricate nel bucket pubblico `product-images`.

## Campi inviati a Make

```json
{
  "event": "newsletter_subscriber_created",
  "subscriber": {
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
}
```
