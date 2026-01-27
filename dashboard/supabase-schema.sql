-- Supabase Schema for Snowbase
-- Run this in your Supabase SQL Editor

-- Chats table
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New Chat',
  user_id uuid references auth.users(id) on delete cascade,
  shared boolean not null default false,
  share_id text unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- RLS Policies for chats
create policy "Users can view their own chats"
  on public.chats for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chats"
  on public.chats for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own chats"
  on public.chats for update
  using (auth.uid() = user_id);

create policy "Users can delete their own chats"
  on public.chats for delete
  using (auth.uid() = user_id);

create policy "Anyone can view shared chats"
  on public.chats for select
  using (shared = true);

-- RLS Policies for messages
create policy "Users can view messages in their chats"
  on public.messages for select
  using (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
      and (chats.user_id = auth.uid() or chats.shared = true)
    )
  );

create policy "Users can insert messages in their chats"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
create index if not exists chats_user_id_idx on public.chats(user_id);
create index if not exists chats_share_id_idx on public.chats(share_id);
create index if not exists messages_chat_id_idx on public.messages(chat_id);

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for chats updated_at
drop trigger if exists chats_updated_at on public.chats;
create trigger chats_updated_at
  before update on public.chats
  for each row
  execute function public.handle_updated_at();
