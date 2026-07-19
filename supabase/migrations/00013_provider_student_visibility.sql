-- A provider (tutor/coach) needs to see basic profile info (name/email) for their own
-- students/clients in "My Students" - but no existing policy covers a provider viewing a
-- customer's profile (the reverse of "Anyone can view approved provider profiles", which
-- only covers viewing providers). Mirrors the messaging migration's "people they message"
-- policy, but keyed off bookings instead of conversations.
create policy "Users can view profiles of people they've booked with"
    on public.profiles for select
    using (
        exists (
            select 1 from public.bookings b
            where (b.customer_id = auth.uid() and b.provider_id = profiles.id)
               or (b.provider_id = auth.uid() and b.customer_id = profiles.id)
        )
    );

-- Same lesson as the messaging/conversations grant fix: evaluating this new profiles
-- policy (even to reject it) requires a base SELECT grant on bookings for whichever role
-- is running the query - anon already needs to evaluate all of profiles' policies when
-- browsing the public directory, so it needs this grant too even though anon never has
-- real booking rows of its own.
grant select on public.bookings to anon;
