import type {User} from "../types";

const displayFields = [
  "full_name", "name", "phone", "whatsapp", "location", "address", "city",
  "avatar_url", "marketing_preferences", "dark_mode", "auto_schedule_enabled",
  "operating_hours", "weekly_operating_hours", "holiday_schedule",
];

export function projectMerchantSessionMetadata(value: unknown): User["user_metadata"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata = value as Record<string, unknown>;
  return Object.fromEntries(displayFields.filter(key => Object.hasOwn(metadata, key)).map(key => [key, metadata[key]]));
}

export function projectCachedMerchantSession(value: unknown): User | null {
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !value.id) return null;
  const cached = value as User;
  return {
    id: cached.id,
    email: typeof cached.email === "string" ? cached.email : null,
    aud: "authenticated",
    created_at: typeof cached.created_at === "string" ? cached.created_at : undefined,
    app_metadata: {},
    user_metadata: projectMerchantSessionMetadata(cached.user_metadata),
  };
}
