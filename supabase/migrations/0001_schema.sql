create extension if not exists pgcrypto;
create type public.app_role as enum ('candidate','evaluator','admin');
create type public.interview_type as enum ('technical','behavioural');
create type public.session_status as enum ('draft','in_progress','completed','abandoned');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text, email text, role public.app_role not null default 'candidate',
 created_at timestamptz not null default now()
);
create table public.interview_sessions (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references profiles(id) on delete cascade,
 job_role text not null, interview_type public.interview_type not null, difficulty text not null check(difficulty in ('Easy','Medium','Hard')),
 experience_level text not null, total_questions int not null check(total_questions in (5,10,15)),
 status public.session_status not null default 'draft', overall_score numeric(4,2),
 started_at timestamptz not null default now(), completed_at timestamptz
);
create table public.interview_questions (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references interview_sessions(id) on delete cascade,
 question_text text not null, question_type text not null, question_order int not null,
 parent_question_id uuid references interview_questions(id), is_follow_up boolean not null default false, created_at timestamptz not null default now()
);
create table public.candidate_responses (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references interview_sessions(id) on delete cascade,
 question_id uuid not null references interview_questions(id) on delete cascade,
 candidate_id uuid not null references profiles(id) on delete cascade, response_text text not null,
 idempotency_key text, submitted_at timestamptz not null default now(), unique(candidate_id,idempotency_key)
);
create table public.ai_evaluations (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references interview_sessions(id) on delete cascade,
 question_id uuid not null references interview_questions(id) on delete cascade,
 response_id uuid not null unique references candidate_responses(id) on delete cascade,
 relevance_score numeric(3,1), star_score numeric(3,1), specificity_score numeric(3,1), evidence_score numeric(3,1),
 technical_correctness_score numeric(3,1), filler_hedging_score numeric(3,1), overall_score numeric(3,1) not null,
 applicable_dimensions text[] not null, strengths jsonb not null default '[]', weaknesses jsonb not null default '[]',
 suggestions jsonb not null default '[]', evidence_quotes jsonb not null default '[]',
 follow_up_question text, ai_model text not null, rubric_version text not null default '1.0', created_at timestamptz not null default now(),
 check(relevance_score is null or relevance_score between 0 and 10), check(star_score is null or star_score between 0 and 10),
 check(specificity_score is null or specificity_score between 0 and 10), check(evidence_score is null or evidence_score between 0 and 10),
 check(technical_correctness_score is null or technical_correctness_score between 0 and 10),
 check(filler_hedging_score is null or filler_hedging_score between 0 and 10)
);
create table public.human_evaluations (
 id uuid primary key default gen_random_uuid(), evaluator_id uuid not null references profiles(id),
 session_id uuid not null references interview_sessions(id) on delete cascade,
 question_id uuid not null references interview_questions(id) on delete cascade,
 response_id uuid not null references candidate_responses(id) on delete cascade,
 relevance_score numeric(3,1), star_score numeric(3,1), specificity_score numeric(3,1), evidence_score numeric(3,1),
 technical_correctness_score numeric(3,1), filler_hedging_score numeric(3,1), overall_score numeric(3,1),
 comments text, submitted_at timestamptz not null default now(),
 unique(evaluator_id,response_id)
);
create table public.validation_metrics (
 id uuid primary key default gen_random_uuid(), evaluation_dimension text not null, mae numeric,
 mean_score_difference numeric, correlation numeric, sample_count int not null, created_at timestamptz not null default now()
);
create table public.practice_recommendations (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references profiles(id) on delete cascade,
 session_id uuid references interview_sessions(id) on delete cascade, recommendation text not null,
 target_dimension text, created_at timestamptz not null default now()
);
create table public.evaluator_assignments (
 id uuid primary key default gen_random_uuid(), evaluator_id uuid not null references profiles(id) on delete cascade,
 session_id uuid not null references interview_sessions(id) on delete cascade, assigned_at timestamptz default now(),
 unique(evaluator_id,session_id)
);
create index on interview_sessions(candidate_id,started_at desc);
create index on interview_questions(session_id,question_order);
create index on candidate_responses(session_id,submitted_at);
create index on ai_evaluations(session_id);
create index on human_evaluations(session_id);
-- Create profile automatically; role is always candidate at signup.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,email,role) values(new.id,new.raw_user_meta_data->>'full_name',new.email,'candidate'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
alter table profiles enable row level security;
alter table interview_sessions enable row level security;
alter table interview_questions enable row level security;
alter table candidate_responses enable row level security;
alter table ai_evaluations enable row level security;
alter table human_evaluations enable row level security;
alter table validation_metrics enable row level security;
alter table practice_recommendations enable row level security;
alter table evaluator_assignments enable row level security;
create function public.is_evaluator() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role in ('evaluator','admin')) $$;
create policy "profile self read" on profiles for select using(id=auth.uid() or public.is_evaluator());
create policy "profile self update" on profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "candidate own sessions" on interview_sessions for select using(candidate_id=auth.uid() or exists(select 1 from evaluator_assignments a where a.session_id=id and a.evaluator_id=auth.uid()) or (select role='admin' from profiles where id=auth.uid()));
create policy "candidate creates own sessions" on interview_sessions for insert with check(candidate_id=auth.uid());
create policy "candidate updates own sessions" on interview_sessions for update using(candidate_id=auth.uid());
create policy "questions visible to session owner or assigned evaluator" on interview_questions for select using(exists(select 1 from interview_sessions s where s.id=session_id and (s.candidate_id=auth.uid() or exists(select 1 from evaluator_assignments a where a.session_id=s.id and a.evaluator_id=auth.uid()))));
create policy "responses visible to owner or assigned evaluator" on candidate_responses for select using(candidate_id=auth.uid() or exists(select 1 from evaluator_assignments a where a.session_id=session_id and a.evaluator_id=auth.uid()));
create policy "candidate inserts own responses" on candidate_responses for insert with check(candidate_id=auth.uid());
create policy "AI eval visible to owner or assigned evaluator" on ai_evaluations for select using(exists(select 1 from candidate_responses r where r.id=response_id and (r.candidate_id=auth.uid() or exists(select 1 from evaluator_assignments a where a.session_id=r.session_id and a.evaluator_id=auth.uid()))));
create policy "human eval visible to candidate and evaluator" on human_evaluations for select using(evaluator_id=auth.uid() or exists(select 1 from candidate_responses r where r.id=response_id and r.candidate_id=auth.uid()));
create policy "assigned evaluator can rate" on human_evaluations for insert with check(evaluator_id=auth.uid() and exists(select 1 from evaluator_assignments a where a.session_id=session_id and a.evaluator_id=auth.uid()));
create policy "validation evaluator only" on validation_metrics for select using(public.is_evaluator());
create policy "recommendations candidate read" on practice_recommendations for select using(candidate_id=auth.uid());
-- Writes to AI-owned tables are performed only by service-role Edge Functions.
