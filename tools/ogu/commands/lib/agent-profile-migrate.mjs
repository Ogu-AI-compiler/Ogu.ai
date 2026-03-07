/**
 * agent-profile-migrate.mjs — Slice 386
 * Migrates V1 agent profiles to V2 schema.
 * Adds missing fields with safe defaults. Idempotent.
 */

/**
 * isV2Profile(profile) → boolean
 */
export function isV2Profile(profile) {
  return profile && profile.profile_version === 2;
}

/**
 * migrateProfile(profile) → migrated profile
 * Adds V2 fields with safe defaults. Idempotent — running on V2 profile is a no-op.
 */
export function migrateProfile(profile) {
  if (!profile) return profile;
  if (isV2Profile(profile)) return profile;

  const now = profile.created_at || new Date().toISOString();

  return {
    ...profile,
    // V2 fields with safe defaults
    prompt_version:          profile.prompt_version ?? 0,
    experience_digest:       profile.experience_digest ?? "",
    experience_sources_count: profile.experience_sources_count ?? 0,
    role_history:            profile.role_history || [
      { role: profile.role, tier: profile.tier, from: now, to: null },
    ],
    last_prompt_update:      profile.last_prompt_update || null,
    last_learning_event_id:  profile.last_learning_event_id || null,
    profile_version:         2,
    // Ensure role_display exists
    role_display:            profile.role_display || profile.role || "Unknown",
    category:                profile.category || null,
  };
}
