-- ─── PET MARATHON LIVE · Supabase migration 001 ───────────────────────────
-- Chạy file này trong Supabase Dashboard → SQL Editor (dán rồi bấm Run).
-- Bảng lưu kết quả đua + nhật ký quà, và view bảng xếp hạng (thắng nhiều nhất).
-- An toàn chạy lại nhiều lần (IF NOT EXISTS).

-- 1. Kết quả từng cuộc đua (1 dòng / 1 cuộc đua)
create table if not exists public.race_results (
  id            bigint generated always as identity primary key,
  race_id       text not null unique,
  winner_nickname text not null,
  winner_pet    text,
  winner_is_bot boolean not null default false,
  duration_ms   integer,
  total_gifts   integer not null default 0,
  results       jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

-- 2. Nhật ký quà đã kích hoạt chiêu (để đối soát, không chứa thông tin nhạy cảm)
create table if not exists public.gift_log (
  id            bigint generated always as identity primary key,
  race_id       text,
  sender_nickname text not null,
  gift_name     text not null,
  ability_id    text not null,
  target_nickname text,
  created_at    timestamptz not null default now()
);

-- 3. View bảng xếp hạng: ai thắng nhiều nhất (chỉ tính người thật, không tính bot)
create or replace view public.leaderboard as
select
  winner_nickname,
  count(*) filter (where winner_is_bot = false) as wins,
  count(*) as total_races,
  max(created_at) as last_win_at
from public.race_results
group by winner_nickname
order by wins desc, total_races desc;

-- 4. Quyền đọc công khai (chỉ đọc view + ghi qua service key, không cho sửa/xóa)
alter table public.race_results enable row level security;
alter table public.gift_log enable row level security;

drop policy if exists "read race_results" on public.race_results;
create policy "read race_results" on public.race_results
  for select using (true);

drop policy if exists "read gift_log" on public.gift_log;
create policy "read gift_log" on public.gift_log
  for select using (true);
