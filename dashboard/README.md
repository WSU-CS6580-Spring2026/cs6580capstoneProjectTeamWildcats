# Snowbase

A Utah-focused AI assistant for snow conditions and UTA transit schedules.

## Features

- **Snow & Weather** - Real-time snow forecasts and ski resort conditions
- **UTA Transit** - Bus, TRAX, and FrontRunner schedules
- **Interactive Maps** - Location-based responses with Google Maps integration

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Email, Google, GitHub OAuth)
- **AI**: Claude API
- **Styling**: Tailwind CSS
- **Maps**: Google Maps API

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Anthropic API key
- Google Maps API key

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/snowbase.git
cd snowbase
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your credentials in `.env.local`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key from Anthropic |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key |

### 4. Set up Supabase

Create the following tables in your Supabase dashboard:

**chats**
```sql
create table public.chats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text default 'New Chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.chats enable row level security;

create policy "Users can view own chats" on public.chats
  for select using (auth.uid() = user_id);

create policy "Users can create own chats" on public.chats
  for insert with check (auth.uid() = user_id);

create policy "Users can update own chats" on public.chats
  for update using (auth.uid() = user_id);

create policy "Users can delete own chats" on public.chats
  for delete using (auth.uid() = user_id);
```

**messages**
```sql
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references public.chats(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Users can view messages in own chats" on public.messages
  for select using (
    chat_id in (select id from public.chats where user_id = auth.uid())
  );

create policy "Users can create messages in own chats" on public.messages
  for insert with check (
    chat_id in (select id from public.chats where user_id = auth.uid())
  );
```

**User deletion function**
```sql
create or replace function public.delete_user()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

grant execute on function public.delete_user() to authenticated;
```

### 5. Configure OAuth providers (optional)

In your Supabase dashboard, enable Google and/or GitHub OAuth:

1. Go to Authentication > Providers
2. Enable Google/GitHub
3. Add your OAuth credentials
4. Set redirect URL to `http://localhost:3000/auth/callback`

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── (chat)/           # Main chat interface
│   ├── api/              # API routes
│   ├── auth/             # Auth callback
│   ├── guest/            # Guest mode
│   ├── login/            # Login page
│   ├── settings/         # User settings
│   └── signup/           # Signup page
├── components/           # React components
├── hooks/                # Custom hooks
├── lib/
│   ├── supabase/         # Supabase client
│   ├── claude.ts         # AI integration
│   └── uta.ts            # UTA API
└── public/               # Static assets
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other platforms

Build the project and run:

```bash
npm run build
npm run start
```

## License

MIT
