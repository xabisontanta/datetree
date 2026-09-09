begin;

select plan(8);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles_private'::regclass),
  'private creator profiles have RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles_public'::regclass),
  'public creator profiles have RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.profiles_private', 'select'),
  'anon has no select grant on private creator profiles'
);

select ok(
  not has_table_privilege('anon', 'public.profiles_private', 'insert,update,delete'),
  'anon has no write grant on private creator profiles'
);

select ok(
  has_table_privilege('authenticated', 'public.profiles_private', 'select'),
  'authenticated creators can reach the private table before RLS ownership checks'
);

select ok(
  not has_table_privilege('authenticated', 'public.profiles_private', 'delete'),
  'authenticated creators cannot delete private profiles directly'
);

select ok(
  has_table_privilege('anon', 'public.profiles_public', 'select'),
  'anon can reach the public table before published-row RLS checks'
);

set local role anon;

select throws_ok(
  $$select * from public.profiles_private$$,
  '42501',
  null,
  'anonymous reads of private creator profiles are rejected'
);

select * from finish();
rollback;
