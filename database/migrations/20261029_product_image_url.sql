-- Add optional product image URLs without changing existing product records.
alter table public.products
  add column if not exists image_url text;
