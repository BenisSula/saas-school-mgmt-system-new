export function sanitizeText(value: string): string {
  if (value == null) {
    return '';
  }
  return (
    String(value)
      .trim()
      .replace(/[<>]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
  );
}

export function sanitizeIdentifier(value: string): string {
  return sanitizeText(value).replace(/[^a-zA-Z0-9-_]/g, '');
}
