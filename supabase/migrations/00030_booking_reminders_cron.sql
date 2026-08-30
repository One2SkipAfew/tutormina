-- Upcoming-session reminder emails: no user action triggers these, so they need a time-based
-- job. Uses Supabase's built-in pg_cron + pg_net to periodically call an ai-api endpoint
-- (POST /cron/tick), which both sends due reminders AND keeps the Hugging Face Space warm
-- (addressing the cold-start "failed to fetch" AI errors as a side effect).
--
-- Ordering note: everything that cannot fail is created FIRST, and the extension/scheduling
-- steps come last inside exception-handled blocks. pg_cron and pg_net are not available on
-- every Postgres (local `supabase start`, a plain instance, a staging box without them
-- enabled), and an extension error would otherwise abort the whole transaction and leave
-- private.app_config uncreated — which is exactly what happened before this rewrite.

alter table public.bookings add column if not exists reminder_sent_at timestamp with time zone;

-- ---------------------------------------------------------------------------
-- 1. Environment-specific config the cron job needs.
--    Kept out of the migration body because these values differ per environment (local,
--    staging, production) and the secret must never be committed. `private` is not exposed
--    through the Data API.
-- ---------------------------------------------------------------------------
create schema if not exists private;

create table if not exists private.app_config (
    key text primary key,
    value text not null
);

insert into private.app_config (key, value) values
    ('ai_api_url', 'https://CHANGE-ME.hf.space'),
    ('cron_secret', 'CHANGE-ME-TO-A-RANDOM-SECRET')
on conflict (key) do nothing;

-- After running this migration, set the real values (SQL Editor):
--   update private.app_config set value = 'https://<user>-tutormina-ai.hf.space' where key = 'ai_api_url';
--   update private.app_config set value = '<a long random string>'              where key = 'cron_secret';
-- The cron_secret must match ai-api's CRON_SECRET env var (Hugging Face Space secret).

-- ---------------------------------------------------------------------------
-- 2. The function the schedule calls.
--    Created before the extensions exist: the body is only parsed at call time, so a missing
--    net.http_post here is harmless until the job actually runs.
-- ---------------------------------------------------------------------------
create or replace function private.trigger_ai_api_cron_tick()
returns void as $$
declare
    v_url text;
    v_secret text;
begin
    select value into v_url from private.app_config where key = 'ai_api_url';
    select value into v_secret from private.app_config where key = 'cron_secret';

    -- Skip quietly until configured, rather than erroring every 10 minutes.
    if v_url is null or v_url = 'https://CHANGE-ME.hf.space'
       or v_secret is null or v_secret = 'CHANGE-ME-TO-A-RANDOM-SECRET' then
        return;
    end if;

    perform net.http_post(
        url := v_url || '/cron/tick',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Cron-Secret', v_secret
        ),
        body := '{}'::jsonb
    );
exception when others then
    -- A scheduled job that raises leaves noise in cron.job_run_details every 10 minutes and
    -- can mask real failures; reminders are best-effort, so log and move on.
    raise warning 'ai-api cron tick failed: %', sqlerrm;
end;
$$ language plpgsql security definer set search_path = private, net, public;

-- ---------------------------------------------------------------------------
-- 3. Extensions.
--    pg_cron installs into its own `cron` schema and pg_net into `net` — neither is
--    relocatable, so no WITH SCHEMA clause here. On Supabase these can also be toggled on
--    under Database -> Extensions.
-- ---------------------------------------------------------------------------
do $$
begin
    execute 'create extension if not exists pg_cron';
exception when others then
    raise notice 'pg_cron unavailable (%) - reminder emails will not be scheduled. Enable it under Database > Extensions, then re-run this migration.', sqlerrm;
end $$;

do $$
begin
    execute 'create extension if not exists pg_net';
exception when others then
    raise notice 'pg_net unavailable (%) - reminder emails will not be scheduled. Enable it under Database > Extensions, then re-run this migration.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Schedule the job, only if pg_cron actually made it. Unschedule first so re-running this
--    migration replaces the job instead of stacking duplicates.
-- ---------------------------------------------------------------------------
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        begin
            perform cron.unschedule('ai-api-cron-tick');
        exception when others then
            null;  -- No existing job to replace on a first run.
        end;

        perform cron.schedule(
            'ai-api-cron-tick',
            '*/10 * * * *',
            $job$select private.trigger_ai_api_cron_tick();$job$
        );
    end if;
end $$;
