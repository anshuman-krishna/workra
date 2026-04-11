// short, human-readable size: "12.4 mb"
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 b';
  const units = ['b', 'kb', 'mb', 'gb'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}
