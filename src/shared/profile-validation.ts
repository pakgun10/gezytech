/**
 * Shared profile-field validation for the name/pseudonym trio.
 *
 * Single source of truth consumed by:
 *  - the onboarding signup form (StepIdentity) and invite signup (InvitePage)
 *  - the server onboarding route (POST /api/onboarding/profile)
 *  - the server profile route (PATCH /api/me)
 *
 * This module is pure: it returns structured issue codes (never English or
 * localized strings) plus the trimmed values, so each caller can render the
 * codes the way it needs (server -> English message map, client -> i18n).
 * It must NOT import i18n, the DB, or anything client/server specific.
 *
 * Presence is a per-caller policy via `opts.require`: signup requires
 * firstName + pseudonym, while PATCH /api/me is partial and requires nothing.
 * Format rules (length, regex, pseudonym min length) apply to any present,
 * non-empty value regardless of `require`.
 */

export const MAX_NAME_LENGTH = 100
export const MAX_PSEUDONYM_LENGTH = 30
export const MIN_PSEUDONYM_LENGTH = 2
export const PSEUDONYM_REGEX = /^[a-zA-Z0-9_-]+$/

export type ProfileField = 'firstName' | 'lastName' | 'pseudonym'

export type ProfileErrorCode =
  | 'first_name_empty'
  | 'first_name_too_long'
  | 'last_name_too_long'
  | 'pseudonym_empty'
  | 'pseudonym_too_short'
  | 'pseudonym_too_long'
  | 'pseudonym_invalid_chars'

export type ProfileIssue = { field: ProfileField; code: ProfileErrorCode }

export interface ProfileFieldsInput {
  firstName?: unknown
  lastName?: unknown
  pseudonym?: unknown
}

export interface ValidateProfileOptions {
  /** Fields that must be present and non-empty (signup requires firstName + pseudonym). */
  require: readonly ProfileField[]
}

export interface ProfileValidationResult {
  issues: ProfileIssue[]
  values: { firstName: string; lastName: string; pseudonym: string }
}

/** Coerce an unknown input to a trimmed string (undefined/null -> ''). */
function toTrimmed(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

export function validateProfileFields(
  input: ProfileFieldsInput,
  opts: ValidateProfileOptions,
): ProfileValidationResult {
  const firstName = toTrimmed(input.firstName)
  const lastName = toTrimmed(input.lastName)
  const pseudonym = toTrimmed(input.pseudonym)

  const issues: ProfileIssue[] = []
  const requires = (field: ProfileField) => opts.require.includes(field)

  // firstName
  if (!firstName) {
    if (requires('firstName')) issues.push({ field: 'firstName', code: 'first_name_empty' })
  } else if (firstName.length > MAX_NAME_LENGTH) {
    issues.push({ field: 'firstName', code: 'first_name_too_long' })
  }

  // lastName (never required, only length-bounded)
  if (lastName.length > MAX_NAME_LENGTH) {
    issues.push({ field: 'lastName', code: 'last_name_too_long' })
  }

  // pseudonym
  if (!pseudonym) {
    if (requires('pseudonym')) issues.push({ field: 'pseudonym', code: 'pseudonym_empty' })
  } else {
    if (pseudonym.length < MIN_PSEUDONYM_LENGTH) issues.push({ field: 'pseudonym', code: 'pseudonym_too_short' })
    if (pseudonym.length > MAX_PSEUDONYM_LENGTH) issues.push({ field: 'pseudonym', code: 'pseudonym_too_long' })
    if (!PSEUDONYM_REGEX.test(pseudonym)) issues.push({ field: 'pseudonym', code: 'pseudonym_invalid_chars' })
  }

  return { issues, values: { firstName, lastName, pseudonym } }
}
