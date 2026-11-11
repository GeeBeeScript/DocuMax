/** Initials for an avatar: first + last word of the name, else the email's first letter. */
export function initials(name: string | null, email: string): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 0) {
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (words[0][0] + last).toUpperCase();
  }
  return email.charAt(0).toUpperCase() || "?";
}
