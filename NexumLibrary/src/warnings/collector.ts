import type { ConversionWarning, WarningSeverity } from '../types/warnings.js';

export class WarningCollector {
  private items: ConversionWarning[] = [];

  add(severity: WarningSeverity, field: string, message: string, options?: { original?: any; recovered?: any; context?: string }): void {
    this.items.push({
      severity,
      field,
      message,
      original: options?.original,
      recovered: options?.recovered,
      context: options?.context,
    });
  }

  info(field: string, message: string, options?: { original?: any; recovered?: any; context?: string }): void {
    this.add('info', field, message, options);
  }

  warn(field: string, message: string, options?: { original?: any; recovered?: any; context?: string }): void {
    this.add('warn', field, message, options);
  }

  error(field: string, message: string, options?: { original?: any; recovered?: any; context?: string }): void {
    this.add('error', field, message, options);
  }

  list(): ConversionWarning[] {
    return this.items.slice();
  }

  count(severity?: WarningSeverity): number {
    if (!severity) return this.items.length;
    return this.items.filter(w => w.severity === severity).length;
  }

  hasErrors(): boolean {
    return this.count('error') > 0;
  }

  merge(other: WarningCollector): void {
    for (const w of other.list()) {
      this.items.push(w);
    }
  }
}
