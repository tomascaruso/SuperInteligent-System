// Une clases CSS ignorando valores vacíos o falsos.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
