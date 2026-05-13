import { EthDateTime } from 'ethiopian-calendar-date-converter';

/**
 * Returns the current date in the Ethiopian calendar as a string.
 * Format: YYYY/MM/DD (e.g. 2018/08/26)
 */
export function getCurrentEthiopianDate(): string {
  const ethDate = EthDateTime.now();
  const yyyy = ethDate.year;
  const mm = String(ethDate.month).padStart(2, '0');
  const dd = String(ethDate.date).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

/**
 * Returns the current date in the Gregorian calendar as a string.
 * Format: YYYY/MMM/DD (e.g. 2026/May/04)
 */
export function getCurrentGregorianDate(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mmm = months[date.getMonth()];
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mmm}/${dd}`;
}
