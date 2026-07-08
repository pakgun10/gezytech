/**
 * Server-side English messages for profile validation issue codes.
 *
 * The API has no locale context, so routes return English (matching the
 * pre-existing `; `-joined VALIDATION_ERROR contract). Clients localize the
 * codes themselves; this map is only for the server's error payloads.
 */
import {
  MAX_NAME_LENGTH,
  MAX_PSEUDONYM_LENGTH,
  type ProfileErrorCode,
  type ProfileIssue,
} from '@/shared/profile-validation'

const MESSAGES: Record<ProfileErrorCode, string> = {
  first_name_empty: 'firstName cannot be empty',
  first_name_too_long: `firstName must be under ${MAX_NAME_LENGTH} characters`,
  last_name_too_long: `lastName must be under ${MAX_NAME_LENGTH} characters`,
  // Empty and too-short both surface as the same message the route used before.
  pseudonym_empty: 'pseudonym must be at least 2 characters',
  pseudonym_too_short: 'pseudonym must be at least 2 characters',
  pseudonym_too_long: `pseudonym must be under ${MAX_PSEUDONYM_LENGTH} characters`,
  pseudonym_invalid_chars: 'pseudonym can only contain letters, numbers, underscores, and hyphens',
}

export function profileIssueMessage(issue: ProfileIssue): string {
  return MESSAGES[issue.code]
}
