-- Club profile and optional manual payment instructions for the single-club app.
-- Destination details are public only after an explicit Club Admin opt-in.

create table public.club_payment_destinations (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  shopeepay_name text,
  shopeepay_number text,
  qris_image_url text,
  publish_publicly boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint club_payment_destinations_text_lengths check (
    (bank_name is null or char_length(bank_name) <= 60) and
    (bank_account_name is null or char_length(bank_account_name) <= 100) and
    (bank_account_number is null or char_length(bank_account_number) <= 40) and
    (shopeepay_name is null or char_length(shopeepay_name) <= 100) and
    (shopeepay_number is null or char_length(shopeepay_number) <= 40)
  ),
  constraint club_payment_destinations_qris_https check (
    qris_image_url is null or qris_image_url ~ '^https://[^[:space:]]+$'
  )
);

alter table public.club_payment_destinations enable row level security;
revoke all on table public.club_payment_destinations from anon, authenticated;

create or replace function public.club_settings(p_club_id uuid)
returns table (
  club_id uuid,
  name text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  shopeepay_name text,
  shopeepay_number text,
  qris_image_url text,
  publish_publicly boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name,
    d.bank_name, d.bank_account_name, d.bank_account_number,
    d.shopeepay_name, d.shopeepay_number, d.qris_image_url,
    coalesce(d.publish_publicly, false)
  from public.clubs c
  left join public.club_payment_destinations d on d.club_id = c.id
  where c.id = p_club_id and public.is_club_admin(c.id);
$$;

create or replace function public.update_club_settings(
  p_club_id uuid,
  p_name text,
  p_bank_name text,
  p_bank_account_name text,
  p_bank_account_number text,
  p_shopeepay_name text,
  p_shopeepay_number text,
  p_qris_image_url text,
  p_publish_publicly boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bank_name text := nullif(btrim(p_bank_name), '');
  v_bank_account_name text := nullif(btrim(p_bank_account_name), '');
  v_bank_account_number text := nullif(btrim(p_bank_account_number), '');
  v_shopeepay_name text := nullif(btrim(p_shopeepay_name), '');
  v_shopeepay_number text := nullif(btrim(p_shopeepay_number), '');
  v_qris_image_url text := nullif(btrim(p_qris_image_url), '');
begin
  if not public.is_club_admin(p_club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 60 then
    raise exception 'Nama klub harus berisi 2 sampai 60 karakter';
  end if;
  if v_bank_name is not null and char_length(v_bank_name) > 60 then
    raise exception 'Nama bank maksimal 60 karakter';
  end if;
  if v_bank_account_name is not null and char_length(v_bank_account_name) > 100 then
    raise exception 'Nama pemilik rekening maksimal 100 karakter';
  end if;
  if v_bank_account_number is not null and char_length(v_bank_account_number) > 40 then
    raise exception 'Nomor rekening maksimal 40 karakter';
  end if;
  if v_shopeepay_name is not null and char_length(v_shopeepay_name) > 100 then
    raise exception 'Nama akun ShopeePay maksimal 100 karakter';
  end if;
  if v_shopeepay_number is not null and char_length(v_shopeepay_number) > 40 then
    raise exception 'Nomor ShopeePay maksimal 40 karakter';
  end if;
  if v_qris_image_url is not null and v_qris_image_url !~ '^https://[^[:space:]]+$' then
    raise exception 'Tautan QRIS harus menggunakan HTTPS';
  end if;
  if coalesce(p_publish_publicly, false) and
     v_bank_account_number is null and v_shopeepay_number is null and v_qris_image_url is null then
    raise exception 'Tambahkan setidaknya satu tujuan pembayaran sebelum menampilkannya';
  end if;

  update public.clubs set name = btrim(p_name) where id = p_club_id;
  insert into public.club_payment_destinations (
    club_id, bank_name, bank_account_name, bank_account_number,
    shopeepay_name, shopeepay_number, qris_image_url, publish_publicly, updated_at
  ) values (
    p_club_id, v_bank_name, v_bank_account_name, v_bank_account_number,
    v_shopeepay_name, v_shopeepay_number, v_qris_image_url,
    coalesce(p_publish_publicly, false), now()
  )
  on conflict (club_id) do update set
    bank_name = excluded.bank_name,
    bank_account_name = excluded.bank_account_name,
    bank_account_number = excluded.bank_account_number,
    shopeepay_name = excluded.shopeepay_name,
    shopeepay_number = excluded.shopeepay_number,
    qris_image_url = excluded.qris_image_url,
    publish_publicly = excluded.publish_publicly,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.public_payment_destinations(p_club_id uuid)
returns table (
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  shopeepay_name text,
  shopeepay_number text,
  qris_image_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.bank_name, d.bank_account_name, d.bank_account_number,
    d.shopeepay_name, d.shopeepay_number, d.qris_image_url
  from public.club_payment_destinations d
  where d.club_id = p_club_id and d.publish_publicly;
$$;

revoke execute on function public.club_settings(uuid),
  public.update_club_settings(uuid, text, text, text, text, text, text, text, boolean),
  public.public_payment_destinations(uuid) from public, anon, authenticated;
grant execute on function public.club_settings(uuid),
  public.update_club_settings(uuid, text, text, text, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.public_payment_destinations(uuid) to anon, authenticated;
