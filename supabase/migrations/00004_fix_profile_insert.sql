-- ============================================
-- Fix RLS Policies for Profiles and Providers
-- ============================================

-- 1. PROFILES INSERT POLICY
-- Allow authenticated users to create their own profile during signup
create policy "Users can insert their own profile"
    on public.profiles for insert
    with check (auth.uid() = id);

-- 2. BOOKINGS INSERT POLICY
-- Ensure customers can insert a booking
create policy "Customers can create bookings"
    on public.bookings for insert
    with check (auth.uid() = customer_id);

-- Add missing GRANTs for authenticated users so RLS can take over
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.provider_details TO authenticated;
GRANT ALL ON public.bookings TO authenticated;

-- Allow users to view bookings where they are the customer or the provider
create policy "Users can view their own bookings"
    on public.bookings for select
    using (auth.uid() = customer_id or auth.uid() = provider_id);

-- Allow providers to update bookings (to confirm/decline)
create policy "Providers can update bookings"
    on public.bookings for update
    using (auth.uid() = provider_id or auth.uid() = customer_id);
