-- Pi Brain: keep the interface locale independent from quiz-content locale.
-- Existing accounts retain their previous locale as their initial quiz locale.
create or replace function public.save_user_preferences(
  p_profile_id uuid,
  p_preferences jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_preferences%rowtype;
  v_language text;
  v_quiz_language text;
begin
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'Invalid preferences payload';
  end if;

  v_language := coalesce(p_preferences ->> 'language', 'en');
  v_quiz_language := coalesce(p_preferences ->> 'quizLanguage', v_language);

  if v_language !~ '^(en|fa|ar|de|es|fr|ru|tr|hi|zh|ja|pt)$'
     or v_quiz_language !~ '^(en|fa|ar|de|es|fr|ru|tr|hi|zh|ja|pt)$' then
    raise exception 'Unsupported preference language';
  end if;

  insert into public.user_preferences(profile_id, preferences, version)
  values (p_profile_id, jsonb_set(p_preferences, '{quizLanguage}', to_jsonb(v_quiz_language), true), 1)
  on conflict (profile_id) do update
    set preferences = excluded.preferences,
        version = public.user_preferences.version + 1,
        updated_at = now()
    where public.user_preferences.version = p_expected_version
  returning * into v_row;

  if not found then
    raise exception 'PREFERENCES_VERSION_CONFLICT';
  end if;

  -- profiles.locale remains the interface language for backwards compatibility.
  update public.profiles
  set locale = v_language,
      updated_at = now()
  where id = p_profile_id;

  return jsonb_build_object(
    'preferences', v_row.preferences,
    'version', v_row.version,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.save_user_preferences(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.save_user_preferences(uuid, jsonb, integer) to service_role;
