-- Search query used for the “Cute animals” bonus GIPHY GIFs.
alter table public.profiles
  add column if not exists giphy_query text not null default 'cute animal'
    check (char_length(btrim(giphy_query)) between 1 and 80);
