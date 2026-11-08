-- Allawii — 0006: seed reference data

insert into public.app_settings (key, value) values
  ('platform', jsonb_build_object(
    'demo_mode', true,
    'currency', 'NGN',
    'min_transfer_minor', 10000,      -- ₦100
    'max_transfer_minor', 50000000,   -- ₦500,000
    'daily_transfer_minor', 100000000,-- ₦1,000,000
    'transfer_fee_minor', 0,
    'fee_cap_minor', 200000,
    'min_deposit_minor', 10000,
    'brand_name', 'Allawii',
    'product_line', 'Student wallet and savings goals'
  ))
on conflict (key) do update set value = public.app_settings.value || excluded.value, updated_at = now();

insert into public.banks (code, name) values
  ('044','Access Bank'), ('063','Access Bank (Diamond)'), ('023','Citibank'),
  ('050','Ecobank'), ('070','Fidelity Bank'), ('011','First Bank of Nigeria'),
  ('214','First City Monument Bank'), ('103','Globus Bank'), ('058','Guaranty Trust Bank'),
  ('030','Heritage Bank'), ('301','Jaiz Bank'), ('082','Keystone Bank'),
  ('50211','Kuda Microfinance Bank'), ('076','Polaris Bank'), ('101','Providus Bank'),
  ('221','Stanbic IBTC Bank'), ('068','Standard Chartered Bank'), ('232','Sterling Bank'),
  ('100','SunTrust Bank'), ('032','Union Bank'), ('033','United Bank for Africa'),
  ('215','Unity Bank'), ('035','Wema Bank'), ('057','Zenith Bank'),
  ('999992','OPay Digital Services'), ('999991','PalmPay'), ('50515','Moniepoint MFB'),
  ('51318','FairMoney MFB'), ('565','Carbon'), ('566','VFD Microfinance Bank'),
  ('51310','Sparkle Microfinance Bank'), ('125','Rubies MFB'), ('102','Titan Trust Bank'),
  ('105','PremiumTrust Bank'), ('107','Optimus Bank'), ('104','Parallex Bank'),
  ('303','Lotus Bank'), ('120001','9 Payment Service Bank'), ('120002','Hope Payment Service Bank'),
  ('120003','MOMO Payment Service Bank')
on conflict (code) do update set name = excluded.name, is_active = true;

-- storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-documents', 'kyc-documents', false, 5242880, array['image/png','image/jpeg','application/pdf'])
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists avatars_user_write on storage.objects;
create policy avatars_user_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists kyc_user_write on storage.objects;
create policy kyc_user_write on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists kyc_user_read on storage.objects;
create policy kyc_user_read on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
