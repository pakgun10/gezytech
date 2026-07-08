/**
 * Map shared profile validation issue codes to localized strings.
 *
 * Keeps the codes -> i18n key mapping in one place so both signup call sites
 * (StepIdentity, InvitePage) render the same messages.
 */
import type { TFunction } from 'i18next'
import {
  MAX_NAME_LENGTH,
  MAX_PSEUDONYM_LENGTH,
  type ProfileErrorCode,
} from '@/shared/profile-validation'

export function translateProfileErrorCode(t: TFunction, code: ProfileErrorCode): string {
  switch (code) {
    case 'first_name_empty':
      return t('validation.profile.firstNameEmpty')
    case 'first_name_too_long':
      return t('validation.profile.firstNameTooLong', { max: MAX_NAME_LENGTH })
    case 'last_name_too_long':
      return t('validation.profile.lastNameTooLong', { max: MAX_NAME_LENGTH })
    case 'pseudonym_empty':
      return t('validation.profile.pseudonymEmpty')
    case 'pseudonym_too_short':
      return t('validation.profile.pseudonymTooShort')
    case 'pseudonym_too_long':
      return t('validation.profile.pseudonymTooLong', { max: MAX_PSEUDONYM_LENGTH })
    case 'pseudonym_invalid_chars':
      return t('validation.profile.pseudonymInvalidChars')
  }
}
