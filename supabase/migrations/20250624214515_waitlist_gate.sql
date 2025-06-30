-- Waitlist Gate Implementation using auth.verify_signup hook
-- This function is automatically called by Supabase Auth during signup
-- Returns false to block signup if user is not on the approved waitlist

create or replace function auth.verify_signup(
  email text,
  phone text,
  raw_user_data jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    is_approved boolean;
begin
    -- Check if the email exists in our waitlist and is approved
    select exists(
        select 1 
        from public.waitlist 
        where lower(email) = lower(verify_signup.email)
    ) into is_approved;
    
    -- Also check waitlist_applications table for accepted status
    if not is_approved then
        select exists(
            select 1 
            from public.waitlist_applications 
            where lower(email) = lower(verify_signup.email) 
            and status = 'accepted'
        ) into is_approved;
    end if;
    
    -- Log the signup attempt for monitoring
    insert into public.waitlist_applications (
        name,
        email,
        linkedin,
        reason,
        status,
        created_at,
        updated_at
    ) values (
        coalesce(raw_user_data->>'name', 'Unknown'),
        verify_signup.email,
        coalesce(raw_user_data->>'linkedin', ''),
        coalesce(raw_user_data->>'reason', 'Direct signup attempt'),
        case when is_approved then 'accepted' else 'pending' end,
        now(),
        now()
    )
    on conflict (email) do update set
        updated_at = now(),
        status = case when is_approved then 'accepted' else excluded.status end;
    
    -- Return true to allow signup, false to block
    return coalesce(is_approved, false);
end;
$$;

-- Grant necessary permissions
grant execute on function auth.verify_signup(text, text, jsonb) to anon;
grant execute on function auth.verify_signup(text, text, jsonb) to authenticated;
grant execute on function auth.verify_signup(text, text, jsonb) to service_role;

-- Comment explaining the function
comment on function auth.verify_signup(text, text, jsonb) is 
'Waitlist gate function that blocks user signups unless they are pre-approved in the waitlist or waitlist_applications tables';
