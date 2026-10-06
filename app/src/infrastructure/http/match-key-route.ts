export function matchKeyRoute(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const rawKey = pathname.slice(prefix.length);
  return rawKey.length > 0 && !rawKey.includes("/") ? rawKey : null;
}
