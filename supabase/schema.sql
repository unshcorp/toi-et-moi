-- TOI&MOI standalone schema. Run in a new Supabase project's SQL editor.
-- Intentionally creates no user or application content.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '', last_name text not null default '', display_name text not null default '',
  show_first_name boolean not null default true,
  age smallint check (age is null or age >= 18), gender text,
  education_level text, family_status text, children_status text, children_count smallint check (children_count is null or children_count between 0 and 30),
  smoker_status text, alcohol_status text,
  city text, neighborhood text, avatar_url text, cover_url text, bio text,
  profession text, languages text[] not null default '{}', interests text[] not null default '{}',
  emojis text[] not null default '{}', values text[] not null default '{}',
  relationship_type text, suspended_at timestamptz, verified_at timestamptz,
  is_deactivated boolean not null default false, is_restricted boolean not null default false, last_active_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.profile_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text unique, terms_accepted_at timestamptz, birth_date date, show_first_name boolean not null default true,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.profile_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  relationship_types text[] not null default '{}', min_age smallint not null default 18 check(min_age>=18),
  max_age smallint not null default 60 check(max_age>=min_age), preferred_gender text not null default 'Tout le monde',
  max_distance_km smallint not null default 25 check(max_distance_km between 1 and 100),
  city text, neighborhoods text[] not null default '{}', activities text[] not null default '{}',
  venues text, verified_only boolean not null default false, active_only boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '', image_url text, interests text[] not null default '{}',
  activity text, neighborhood text, destination_url text,
  status text not null default 'active' check (status in ('active','archived','removed')),
  is_guest_of_day boolean not null default false, is_sponsored boolean not null default false,
  is_admin_post boolean not null default false, view_count bigint not null default 0, pinned_until timestamptz,
  created_at timestamptz not null default now(), visible_until timestamptz not null default (now() + interval '3 days')
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade, body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create table if not exists public.tuch_me_requests (
  id uuid primary key default gen_random_uuid(), from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(), responded_at timestamptz,
  check (from_user <> to_user), unique(from_user,to_user)
);
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(), user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), check(user_one <> user_two), unique(user_one,user_two)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.connections(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade, body text not null default '', photo_url text,
  check (length(btrim(body)) > 0 or photo_url is not null),
  created_at timestamptz not null default now(), read_at timestamptz
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, link text, created_at timestamptz not null default now(), read_at timestamptz
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade, reason text not null,
  status text not null default 'open' check(status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  statement text not null check(length(btrim(statement)) between 20 and 3000),
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(), reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id), response text
);
create table if not exists public.blocked_users (
  user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,blocked_user_id), check(user_id <> blocked_user_id)
);
create table if not exists public.ad_submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  description text not null, image_url text, contact text, destination_url text,
  payment_method text not null default 'points' check(payment_method in ('points','airtel_money')),
  payment_status text not null default 'pending' check(payment_status in ('pending','paid')),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), reviewed_at timestamptz
);
create table if not exists public.nafa_payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  ad_submission_id uuid not null unique references public.ad_submissions(id) on delete cascade,
  nafa_payment_id text unique, reference text not null unique, amount integer not null check(amount > 0),
  currency text not null, status text not null default 'pending' check(status in ('pending','completed','failed','expired')),
  checkout_url text, created_at timestamptz not null default now(), completed_at timestamptz
);
alter table public.nafa_payments enable row level security;
create policy "users read own nafa payments" on public.nafa_payments for select to authenticated using(user_id=(select auth.uid()));
create table if not exists public.profile_verifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','approved','rejected','removed')),
  document_type text, front_path text, back_path text, selfie_path text, rejection_reason text,
  reviewed_by uuid references auth.users(id), created_at timestamptz not null default now(), reviewed_at timestamptz, unique(user_id)
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewed_user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check(rating between 1 and 5), body text,
  created_at timestamptz not null default now(), check(reviewer_id<>reviewed_user_id), unique(reviewer_id,reviewed_user_id)
);

create index if not exists posts_feed_idx on public.posts(status, created_at desc);
create index if not exists posts_author_idx on public.posts(author_id, created_at desc);
create index if not exists tuch_me_inbox_idx on public.tuch_me_requests(to_user,status,created_at desc);
create index if not exists comments_post_idx on public.comments(post_id,created_at);
create index if not exists notifications_user_idx on public.notifications(user_id,created_at desc);
create index if not exists appeals_status_idx on public.appeals(status,created_at desc);
create index if not exists appeals_user_id_idx on public.appeals(user_id);
create index if not exists appeals_reviewed_by_idx on public.appeals(reviewed_by);
create index if not exists profile_verifications_reviewed_by_idx on public.profile_verifications(reviewed_by);
create index if not exists ad_submissions_user_idx on public.ad_submissions(user_id);
create index if not exists blocked_users_blocked_user_idx on public.blocked_users(blocked_user_id);
create index if not exists comments_author_idx on public.comments(author_id);
create index if not exists connections_user_two_idx on public.connections(user_two);
create index if not exists messages_connection_idx on public.messages(connection_id);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists post_likes_user_idx on public.post_likes(user_id);
create index if not exists reports_post_idx on public.reports(post_id);
create index if not exists reports_reported_user_idx on public.reports(reported_user_id);
create index if not exists reports_reporter_idx on public.reports(reporter_id);
create index if not exists reviews_reviewed_user_idx on public.reviews(reviewed_user_id);

create or replace function public.set_updated_at() returns trigger
language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.protect_admin_fields() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    if tg_table_name = 'profiles' then
      if new.suspended_at is distinct from old.suspended_at or new.verified_at is distinct from old.verified_at
        or new.is_restricted is distinct from old.is_restricted or new.last_active_at is distinct from old.last_active_at then
        raise exception 'Ces champs sont réservés à l’administration.' using errcode = '42501';
      end if;
    elsif tg_table_name = 'posts' then
      if new.is_guest_of_day is distinct from old.is_guest_of_day or new.is_admin_post is distinct from old.is_admin_post
        or new.is_sponsored is distinct from old.is_sponsored or new.view_count is distinct from old.view_count then
        raise exception 'La mise à la une est réservée à l’administration.' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_admin_fields on public.profiles;
create trigger profiles_protect_admin_fields before update on public.profiles
for each row execute function public.protect_admin_fields();
drop trigger if exists posts_protect_admin_fields on public.posts;
create trigger posts_protect_admin_fields before update on public.posts
for each row execute function public.protect_admin_fields();

create or replace function public.enforce_daily_app_limits() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare used_today integer;
declare verified boolean;
declare administrator boolean;
declare daily_limit integer;
begin
  administrator := (select public.is_admin());
  if tg_table_name = 'posts' then
    if new.author_id is distinct from auth.uid() then raise exception 'Auteur invalide.' using errcode='42501'; end if;
    new.view_count := 0;
    select p.verified_at is not null into verified from public.profiles p where p.id=auth.uid();
    if new.image_url is null and not administrator then raise exception 'Une photo est requise pour publier.' using errcode='23514'; end if;
    if administrator then
      new.is_admin_post := true; new.is_sponsored := true;
      new.created_at := clock_timestamp(); new.visible_until := new.created_at + interval '10 days';
      return new;
    end if;
    select count(*) into used_today from public.posts p
      where p.author_id = auth.uid() and timezone('Europe/Paris',p.created_at)::date=timezone('Europe/Paris',now())::date and p.status <> 'removed';
    daily_limit := case when coalesce(verified,false) then 10 else 1 end;
    if used_today >= daily_limit then raise exception 'Limite de publications quotidiennes atteinte.' using errcode = 'P0001'; end if;
    new.is_admin_post := false; new.is_sponsored := false; new.is_guest_of_day := false;
    new.created_at := clock_timestamp(); new.visible_until := new.created_at + interval '3 days';
  elsif tg_table_name = 'tuch_me_requests' then
    if new.from_user is distinct from auth.uid() then raise exception 'Expéditeur invalide.' using errcode='42501'; end if;
    select p.verified_at is not null into verified from public.profiles p where p.id=auth.uid();
    if not coalesce(verified,false) and not administrator then raise exception 'La vérification du compte est requise pour envoyer un TUCH ME.' using errcode='42501'; end if;
    select count(*) into used_today from public.tuch_me_requests r
      where r.from_user = auth.uid() and timezone('Europe/Paris',r.created_at)::date=timezone('Europe/Paris',now())::date;
    if used_today >= 10 and not administrator then raise exception 'Limite de 10 TUCH ME par jour atteinte.' using errcode = 'P0001'; end if;
    new.created_at := clock_timestamp();
  end if;
  return new;
end $$;
drop trigger if exists posts_daily_limit on public.posts;
create trigger posts_daily_limit before insert on public.posts
for each row execute function public.enforce_daily_app_limits();
drop trigger if exists tuch_me_daily_limit on public.tuch_me_requests;
create trigger tuch_me_daily_limit before insert on public.tuch_me_requests
for each row execute function public.enforce_daily_app_limits();

create or replace function public.protect_tuch_me_response() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if (select public.is_admin()) then return new; end if;
  if auth.uid() is null or auth.uid() <> old.to_user or new.from_user <> old.from_user or new.to_user <> old.to_user then
    raise exception 'Seul le destinataire peut répondre à cette demande.' using errcode = '42501';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted','declined') then
    raise exception 'Cette demande a déjà reçu une réponse.' using errcode = '42501';
  end if;
  new.responded_at := coalesce(new.responded_at, clock_timestamp());
  return new;
end $$;
drop trigger if exists protect_tuch_me_response on public.tuch_me_requests;
create trigger protect_tuch_me_response before update on public.tuch_me_requests
for each row execute function public.protect_tuch_me_response();

create or replace function public.reject_admin_name() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare normalized_first text;
declare normalized_display text;
begin
  if (select public.is_admin()) then return new; end if;
  normalized_first := regexp_replace(lower(coalesce(new.first_name,'')), '[^a-z0-9]', '', 'g');
  normalized_display := regexp_replace(lower(coalesce(new.display_name,'')), '[^a-z0-9]', '', 'g');
  if normalized_first like 'admin%' or normalized_first like 'administrateur%' or normalized_first like 'administrator%'
    or normalized_display like 'admin%' or normalized_display like 'administrateur%' or normalized_display like 'administrator%' then
    raise exception 'Ce nom est réservé au compte officiel.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger profiles_reject_admin_name before insert or update of first_name,display_name on public.profiles
for each row execute function public.reject_admin_name();

create or replace function public.set_profile_age_from_birth_date() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare dob date;
begin
  if (select public.is_admin()) then return new; end if;
  select birth_date into dob from public.profile_private where user_id=new.id;
  if dob is null then raise exception 'Une date de naissance privée est requise.' using errcode='23514'; end if;
  new.age := date_part('year', age(current_date,dob))::smallint;
  if new.age < 18 then raise exception 'L’inscription est réservée aux personnes majeures.' using errcode='23514'; end if;
  return new;
end $$;
create trigger profiles_derive_age before insert or update of age on public.profiles
for each row execute function public.set_profile_age_from_birth_date();

create or replace function public.prevent_profile_privilege_on_insert() returns trigger
language plpgsql security invoker set search_path = ''
as $$ begin
  if not (select public.is_admin()) then
    new.suspended_at:=null;new.verified_at:=null;new.is_restricted:=false;new.is_deactivated:=false;new.last_active_at:=null;
  end if;
  return new;
end $$;
create trigger profiles_privileges_on_insert before insert on public.profiles
for each row execute function public.prevent_profile_privilege_on_insert();

create or replace function public.protect_birth_date() returns trigger
language plpgsql security invoker set search_path = ''
as $$ begin
  if old.birth_date is not null and new.birth_date is distinct from old.birth_date and not (select public.is_admin()) then
    raise exception 'La date de naissance ne peut pas être modifiée après validation.' using errcode='42501';
  end if;
  if new.phone is not null then new.phone := regexp_replace(trim(new.phone), '[[:space:]]+', '', 'g'); end if;
  return new;
end $$;
create trigger profile_private_protect_birth_date before update on public.profile_private
for each row execute function public.protect_birth_date();

create or replace function public.validate_profile_completion() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if (select public.is_admin()) then return new; end if;
  if btrim(coalesce(new.first_name,''))='' or btrim(coalesce(new.last_name,''))='' or btrim(coalesce(new.profession,''))='' then
    raise exception 'Prénom, nom et profession sont obligatoires.' using errcode='23514';
  end if;
  if new.education_level not in ('Collège','Lycée','Université','Travailleur')
    or new.family_status not in ('Célibataire','En relation libre','Autre')
    or new.children_status not in ('Oui','Non') or new.smoker_status not in ('Oui','Non')
    or new.alcohol_status not in ('Jamais','Occasionnellement','Souvent') then
    raise exception 'Complète les informations personnelles obligatoires.' using errcode='23514';
  end if;
  if new.children_status='Oui' and (new.children_count is null or new.children_count<1) then
    raise exception 'Indique le nombre d’enfants.' using errcode='23514';
  end if;
  if cardinality(new.values)<>3 or (select count(distinct value) from unnest(new.values) value)<>3 then
    raise exception 'Choisis exactement trois valeurs personnelles.' using errcode='23514';
  end if;
  if cardinality(new.interests)<>7 or (select count(distinct value) from unnest(new.interests) value)<>7 then
    raise exception 'Choisis exactement sept centres d’intérêt.' using errcode='23514';
  end if;
  if cardinality(new.emojis)<>3 then raise exception 'Choisis exactement trois emojis.' using errcode='23514'; end if;
  return new;
end $$;
create trigger profiles_validate_completion before insert or update of first_name,last_name,profession,education_level,family_status,children_status,children_count,smoker_status,alcohol_status,values,interests,emojis on public.profiles
for each row execute function public.validate_profile_completion();

create or replace function public.protect_verification_decision() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if (select public.is_admin()) then
    if new.status is distinct from old.status then new.reviewed_at := clock_timestamp(); new.reviewed_by := auth.uid(); end if;
    return new;
  end if;
  if old.user_id is distinct from auth.uid() or old.status <> 'rejected' or new.user_id is distinct from old.user_id or new.status <> 'pending' then
    raise exception 'Une nouvelle demande peut uniquement remplacer une demande refusée.' using errcode='42501';
  end if;
  new.reviewed_at := null; new.reviewed_by := null; new.rejection_reason := null;
  return new;
end $$;
create trigger profile_verifications_protect_decision before update on public.profile_verifications
for each row execute function public.protect_verification_decision();

create or replace function public.protect_appeal_review() returns trigger
language plpgsql security invoker set search_path = ''
as $$ begin
  if not (select public.is_admin()) then raise exception 'Action réservée à l’administration.' using errcode='42501'; end if;
  new.reviewed_by := auth.uid(); new.reviewed_at := clock_timestamp(); return new;
end $$;
create trigger appeals_protect_review before update on public.appeals
for each row execute function public.protect_appeal_review();

create or replace function public.protect_message_updates() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if new.connection_id is distinct from old.connection_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.photo_url is distinct from old.photo_url
    or new.created_at is distinct from old.created_at then
    raise exception 'Le contenu d’un message envoyé ne peut pas être modifié.' using errcode = '42501';
  end if;
  if new.read_at is distinct from old.read_at and (auth.uid() is null or auth.uid() = old.sender_id) then
    raise exception 'Seul le destinataire peut marquer ce message comme lu.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists messages_protect_updates on public.messages;
create trigger messages_protect_updates before update on public.messages
for each row execute function public.protect_message_updates();

create or replace function public.enforce_daily_photo_limit() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare used_today integer;
begin
  if new.photo_url is not null then
    select count(*) into used_today from public.messages m
    where m.sender_id = auth.uid() and m.photo_url is not null and timezone('Europe/Paris',m.created_at)::date=timezone('Europe/Paris',now())::date;
    if used_today >= 10 then raise exception 'Limite de 10 photos par jour atteinte.' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
drop trigger if exists messages_daily_photo_limit on public.messages;
create trigger messages_daily_photo_limit before insert on public.messages
for each row execute function public.enforce_daily_photo_limit();

create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select coalesce((select (auth.jwt()->'app_metadata'->>'role') = 'admin'), false) $$;

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.profile_preferences enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.tuch_me_requests enable row level security;
alter table public.connections enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.appeals enable row level security;
alter table public.blocked_users enable row level security;
alter table public.ad_submissions enable row level security;
alter table public.profile_verifications enable row level security;
alter table public.reviews enable row level security;

create policy "profiles visible to signed-in users" on public.profiles for select to authenticated using ((suspended_at is null and is_deactivated=false) or id = (select auth.uid()) or (select public.is_admin()));
create policy "profile owner updates own profile" on public.profiles for update to authenticated using (id = (select auth.uid()) or (select public.is_admin())) with check (id = (select auth.uid()) or (select public.is_admin()));
create policy "new user creates own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "private profile owner and admin" on public.profile_private for all to authenticated using (user_id = (select auth.uid()) or (select public.is_admin())) with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "users manage own preferences" on public.profile_preferences for all to authenticated using (user_id=(select auth.uid()) or (select public.is_admin())) with check (user_id=(select auth.uid()) or (select public.is_admin()));

create policy "active posts visible to signed-in users" on public.posts for select to authenticated using ((status = 'active' and visible_until > now()) or author_id = (select auth.uid()) or (select public.is_admin()));
create policy "authors create posts" on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy "authors and admins update posts" on public.posts for update to authenticated using (author_id = (select auth.uid()) or (select public.is_admin())) with check (author_id = (select auth.uid()) or (select public.is_admin()));
create policy "authors delete posts" on public.posts for delete to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy "comments visible with posts" on public.comments for select to authenticated using (exists(select 1 from public.posts p where p.id=post_id));
create policy "verified users comment" on public.comments for insert to authenticated with check (
  author_id=(select auth.uid()) and ((select public.is_admin()) or exists(
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.verified_at is not null and p.suspended_at is null and p.is_deactivated=false
  ))
);
create policy "comment author and admin manage" on public.comments for delete to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()));
create policy "likes visible to signed in users" on public.post_likes for select to authenticated using (true);
create policy "users insert own likes" on public.post_likes for insert to authenticated with check (user_id=(select auth.uid()) or (select public.is_admin()));
create policy "users delete own likes" on public.post_likes for delete to authenticated using (user_id=(select auth.uid()) or (select public.is_admin()));

create policy "requests visible to participants" on public.tuch_me_requests for select to authenticated using (from_user=(select auth.uid()) or to_user=(select auth.uid()) or (select public.is_admin()));
create policy "users send requests" on public.tuch_me_requests for insert to authenticated with check (from_user=(select auth.uid()));
create policy "recipient answers requests" on public.tuch_me_requests for update to authenticated using (to_user=(select auth.uid()) or (select public.is_admin())) with check (to_user=(select auth.uid()) or (select public.is_admin()));
create policy "connections visible to participants" on public.connections for select to authenticated using (user_one=(select auth.uid()) or user_two=(select auth.uid()) or (select public.is_admin()));
create policy "accepted request participants create connection" on public.connections for insert to authenticated with check (exists(select 1 from public.tuch_me_requests r where r.status='accepted' and (r.from_user=(select auth.uid()) or r.to_user=(select auth.uid())) and least(r.from_user,r.to_user)=least(user_one,user_two) and greatest(r.from_user,r.to_user)=greatest(user_one,user_two)) or (select public.is_admin()));
create policy "participants read messages" on public.messages for select to authenticated using (created_at >= now() - interval '7 days' and (exists(select 1 from public.connections c where c.id=connection_id and ((c.user_one=(select auth.uid())) or (c.user_two=(select auth.uid())))) or (select public.is_admin())));
create policy "participants send messages" on public.messages for insert to authenticated with check (sender_id=(select auth.uid()) and exists(select 1 from public.connections c where c.id=connection_id and ((c.user_one=(select auth.uid())) or (c.user_two=(select auth.uid())))));
create policy "participants mark messages read" on public.messages for update to authenticated
using (sender_id <> (select auth.uid()) and exists(select 1 from public.connections c where c.id=connection_id and (c.user_one=(select auth.uid()) or c.user_two=(select auth.uid()))))
with check (sender_id <> (select auth.uid()) and exists(select 1 from public.connections c where c.id=connection_id and (c.user_one=(select auth.uid()) or c.user_two=(select auth.uid()))));
create policy "users read notifications" on public.notifications for select to authenticated using (user_id=(select auth.uid()) or (select public.is_admin()));
create policy "users mark notifications read" on public.notifications for update to authenticated using (user_id=(select auth.uid()) or (select public.is_admin())) with check (user_id=(select auth.uid()) or (select public.is_admin()));
create policy "reporters and admins read reports" on public.reports for select to authenticated using (reporter_id=(select auth.uid()) or (select public.is_admin()));
create policy "users create reports" on public.reports for insert to authenticated with check (reporter_id=(select auth.uid()));
create policy "admins update reports" on public.reports for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "users create own restricted appeals" on public.appeals for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_restricted=true));
create policy "users read own appeals admins moderate" on public.appeals for select to authenticated
using (user_id=(select auth.uid()) or (select public.is_admin()));
create policy "admins update appeals" on public.appeals for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "users manage own blocked list" on public.blocked_users for all to authenticated using (user_id=(select auth.uid()) or (select public.is_admin())) with check (user_id=(select auth.uid()) or (select public.is_admin()));
create policy "users read own ads admins review" on public.ad_submissions for select to authenticated using (user_id=(select auth.uid()) or (select public.is_admin()));
create policy "users submit ads" on public.ad_submissions for insert to authenticated with check (user_id=(select auth.uid()));
create policy "admins update ads" on public.ad_submissions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "users read own verification admins review" on public.profile_verifications for select to authenticated using (user_id=(select auth.uid()) or (select public.is_admin()));
create policy "users request verification" on public.profile_verifications for insert to authenticated with check (user_id=(select auth.uid()));
create policy "admin review or owner resubmit verification" on public.profile_verifications for update to authenticated
using ((select public.is_admin()) or (user_id=(select auth.uid()) and status='rejected'))
with check ((select public.is_admin()) or (user_id=(select auth.uid()) and status='pending'));
create policy "reviews visible to participants" on public.reviews for select to authenticated using (reviewer_id=(select auth.uid()) or reviewed_user_id=(select auth.uid()) or (select public.is_admin()));
create policy "connected users leave reviews" on public.reviews for insert to authenticated with check (reviewer_id=(select auth.uid()) and exists(select 1 from public.connections c where (c.user_one=reviewer_id and c.user_two=reviewed_user_id) or (c.user_two=reviewer_id and c.user_one=reviewed_user_id)));

-- Public bucket for uploaded profile and post images. Validate ownership by UUID path prefix.
insert into storage.buckets(id,name,public) values ('public-media','public-media',true) on conflict (id) do nothing;
create policy "public-media files are readable" on storage.objects for select to public using (bucket_id='public-media');
create policy "users upload under own folder" on storage.objects for insert to authenticated with check (bucket_id='public-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "users update own files" on storage.objects for update to authenticated using (bucket_id='public-media' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='public-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "users delete own files" on storage.objects for delete to authenticated using (bucket_id='public-media' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_admin())));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('verification-documents','verification-documents',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
create policy "verification documents owner and admins" on storage.objects for select to authenticated
using (bucket_id='verification-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_admin())));
create policy "verification documents owner upload" on storage.objects for insert to authenticated
with check (bucket_id='verification-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "verification documents owner delete" on storage.objects for delete to authenticated
using (bucket_id='verification-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Chat notifications are written by a narrow, non-API trigger function after validating the sender and connection.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.notify_chat_message() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare recipient uuid;
declare sender_name text;
begin
  if auth.uid() is null or auth.uid() <> new.sender_id then raise exception 'Utilisateur expéditeur invalide.' using errcode = '42501'; end if;
  select case when c.user_one = new.sender_id then c.user_two else c.user_one end into recipient
    from public.connections c where c.id = new.connection_id and (c.user_one = auth.uid() or c.user_two = auth.uid());
  if recipient is null then raise exception 'Conversation introuvable.' using errcode = '42501'; end if;
  select coalesce(nullif(p.first_name, ''), 'Un membre') into sender_name from public.profiles p where p.id = new.sender_id;
  insert into public.notifications(user_id, title, link) values (
    recipient,
    case when new.photo_url is not null then sender_name || ' t’a envoyé une photo' else 'Nouveau message de ' || sender_name end,
    '/connections/' || new.connection_id::text
  );
  return new;
end $$;
revoke all on function private.notify_chat_message() from public, anon, authenticated;
drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient after insert on public.messages
for each row execute function private.notify_chat_message();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
