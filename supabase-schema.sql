create extension if not exists pgcrypto;

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  newsletter_language text not null default 'it' check (newsletter_language in ('it','en')),
  site_language text not null default 'it' check (site_language in ('it','en')),
  message text,
  source text not null default 'website',
  page_url text,
  consent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists newsletter_subscribers_created_at_idx
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Public newsletter insert" on public.newsletter_subscribers;
create policy "Public newsletter insert"
  on public.newsletter_subscribers
  for insert
  to anon
  with check (consent = true);

drop policy if exists "Authenticated newsletter read" on public.newsletter_subscribers;
create policy "Authenticated newsletter read"
  on public.newsletter_subscribers
  for select
  to authenticated
  using (true);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  active boolean not null default true,
  sort_order integer not null default 100,
  categoria text not null default 'abbigliamento',
  nome jsonb not null default '{"it":"","en":""}'::jsonb,
  sottotitolo jsonb not null default '{"it":"","en":""}'::jsonb,
  materiale jsonb not null default '{"it":"","en":""}'::jsonb,
  storia jsonb not null default '{"it":"","en":""}'::jsonb,
  prezzo numeric(10,2) not null default 0,
  taglie text[] not null default '{}',
  badge text not null default '',
  badge_class text not null default '',
  foto text[] not null default '{}',
  stripe_link text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_sort_idx
  on public.products (active, sort_order, slug);

alter table public.products enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products
  for select
  to anon
  using (active = true);

drop policy if exists "Authenticated can manage products" on public.products;
create policy "Authenticated can manage products"
  on public.products
  for all
  to authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public product images read" on storage.objects;
create policy "Public product images read"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'product-images');

drop policy if exists "Authenticated product images upload" on storage.objects;
create policy "Authenticated product images upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated product images update" on storage.objects;
create policy "Authenticated product images update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated product images delete" on storage.objects;
create policy "Authenticated product images delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images');
