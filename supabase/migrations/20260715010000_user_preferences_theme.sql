-- Corrective migration: persist appearance preference for authenticated users.
-- Safe default preserves existing rows as system (follow OS).

alter table public.user_preferences
  add column if not exists theme text not null default 'system';

alter table public.user_preferences
  drop constraint if exists user_preferences_theme_check;

alter table public.user_preferences
  add constraint user_preferences_theme_check
  check (theme in ('system', 'light', 'dark'));

comment on column public.user_preferences.theme is
  'Appearance preference: system | light | dark. LocalStorage applies first; DB wins after auth load.';
