// Common-password blocklist.
//
// SCOPE NOTE: this is a curated, bundled subset — not the full SecLists
// "top 10k". With an 8-character minimum, more of that list clears the
// length rule than when this was written against a 12-character minimum
// (see git history / PASSWORD_MIN_LENGTH), so this bundled subset is a
// weaker filter than it was — the short, common entries below matter more
// now, not less. Substituting the full list is a drop-in change: replace
// `RAW_BLOCKLIST` with the file's contents (one entry per line, lowercased)
// and nothing else needs to change.
//
// Matching is length-independent: entries shorter than the minimum are kept
// because they are also checked as the base of padded variants.

const RAW_BLOCKLIST = [
  // Long numeric runs and padded digits
  "123456789012", "1234567890123", "12345678901234", "123456789012345",
  "111111111111", "000000000000", "121212121212", "123123123123",
  "112233445566", "123456654321", "102030405060", "147258369000",
  // "password" and its common padded forms
  "password", "password1", "password12", "password123", "password1234",
  "passwordpassword", "password@123", "password!23", "p@ssword123",
  "p@ssw0rd123", "pa55word123", "passw0rd1234", "mypassword12",
  "newpassword1", "newpassword12", "changepassword", "changeme123",
  "password2024", "password2025", "password2026",
  // Keyboard walks
  "qwertyuiop", "qwertyuiop12", "qwertyuiopas", "qwerty123456",
  "qwerty1234567", "asdfghjkl123", "zxcvbnm12345", "1qaz2wsx3edc",
  "1q2w3e4r5t6y", "qazwsxedcrfv", "qwertzuiop12", "azertyuiop12",
  "poiuytrewq12", "qwerasdfzxcv",
  // Words and phrases that clear 12 characters
  "iloveyou1234", "letmein12345", "welcome12345", "welcometoyou",
  "administrator", "administrator1", "adminadmin12", "administrador",
  "trustno1none", "superman1234", "batman123456", "pokemon12345",
  "princess1234", "sunshine1234", "football1234", "baseball1234",
  "basketball12", "liverpool123", "manchester12", "chelsea12345",
  "michael12345", "jennifer1234", "jordan123456", "computer1234",
  "whatever1234", "starwars1234", "dragon123456", "monkey123456",
  "shadow123456", "master123456", "freedom12345", "qwerty@12345",
  "iloveyou2024", "loveyou12345", "happybirthday", "merrychristmas",
  "godisgood123", "jesuschrist1", "alhamdulillah", "bismillah123",
  // Regional / project-adjacent guesses
  "pakistan1234", "pakistan@123", "karachi12345", "lahore123456",
  "islamabad123", "dubai1234567", "dubai@123456", "abudhabi1234",
  "vizaura12345", "vizaura@1234", "vizauraglobal",
  // Common test/seed values
  "test12345678", "testtest1234", "abcd12345678", "abcdefghijkl",
  "aaaaaaaaaaaa", "asdfasdfasdf", "qweqweqweqwe", "zaq12wsxcde3",
  "secret123456", "letmein@1234", "default12345", "temporary123",
  "welcome@1234", "1234qwerasdf", "samsung12345", "internet1234",
];

const BLOCKLIST = new Set(RAW_BLOCKLIST);

/// Strips trailing digits and common trailing punctuation so that
/// "password1234!" is recognised as a variant of "password".
function stripPadding(value: string): string {
  return value.replace(/[0-9!@#$%^&*._-]+$/u, "");
}

export function isCommonPassword(password: string): boolean {
  const normalised = password.toLowerCase();
  if (BLOCKLIST.has(normalised)) return true;

  const stripped = stripPadding(normalised);
  if (stripped.length >= 4 && BLOCKLIST.has(stripped)) return true;

  // A single repeated character, e.g. "aaaaaaaaaaaaaa".
  if (/^(.)\1+$/u.test(normalised)) return true;

  // A purely sequential ascending or descending digit run.
  if (/^\d+$/u.test(normalised) && isSequentialDigits(normalised)) return true;

  return false;
}

function isSequentialDigits(value: string): boolean {
  let ascending = true;
  let descending = true;
  for (let i = 1; i < value.length; i += 1) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (delta !== 1) ascending = false;
    if (delta !== -1) descending = false;
  }
  return ascending || descending;
}

export const blocklistSize = BLOCKLIST.size;
