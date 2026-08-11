-- Googoo mini-game accepted trigger word (spoken to score a point).
alter table public.profiles
  add column if not exists googoo_word text not null default 'bingo'
    check (googoo_word ~ '^[a-z]{2,24}$');
