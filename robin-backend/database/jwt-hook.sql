-- ============================================================
-- ROBIN OSINT — JWT Custom Access Token Hook
-- Run AFTER all other SQL files in Supabase SQL Editor
-- Then: Authentication → Hooks → Add Custom Access Token hook
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_client_id uuid;
BEGIN
  -- Fetch role and client_id from users table
  SELECT role, client_id
  INTO user_role, user_client_id
  FROM public.users
  WHERE id = (event ->> 'user_id')::uuid;

  -- Get existing claims
  claims := event -> 'claims';

  -- If user exists in our users table, inject role + client_id
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_metadata}',
      COALESCE(claims -> 'user_metadata', '{}'::jsonb) ||
      jsonb_build_object(
        'role', user_role,
        'client_id', user_client_id
      )
    );
    -- Update the event with modified claims
    event := jsonb_set(event, '{claims}', claims);
  END IF;

  RETURN event;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
