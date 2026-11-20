/**
 * Real calendar math: months, days-per-month, weekday offsets, weeks, years.
 * No `date-fns` dependency — everything here is pure and testable.
 *
 * Grid convention: weeks start on **Sunday** (English calendar convention).
 */

import { DOW_SHORT, MONTHS, MONTHS_SHORT } from '~/lib/types'

export interface MonthGrid {
  year: number
  /** 1..12 */
  month: number
  /** Cells of the visible grid, always a multiple of 7. */
  cells: DayCell[]
}

export interface DayCell {
  /** `YYYY-MM-DD` */
  date: string
  day: number
  /** 0 = Sunday .. 6 = Saturday */
  weekday: number
  /** Outside the current month (leading/trailing). */
  adjacent: boolean
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Days in a given month (month is 1..12). */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0
}

/** Weekday of the 1st of the month (0 = Sunday). */
export function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
}

/** Formats a Date/ISO day as `YYYY-MM-DD` (UTC, no timezone drift). */
export function toIsoDay(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Parses `YYYY-MM-DD` into `{ year, month, day, weekday }`. */
export function parseIsoDay(iso: string): { year: number; month: number; day: number; weekday: number } {
  const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10))
  const year = y || 1970
  const month = m || 1
  const day = d || 1
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() }
}

/** Builds the full grid for a month, padded with adjacent-month days. */
export function buildMonthGrid(year: number, month: number): MonthGrid {
  const total = daysInMonth(year, month)
  const lead = firstWeekday(year, month)
  const cells: DayCell[] = []

  // Leading days from the previous month.
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const prevTotal = daysInMonth(prevYear, prevMonth)
  for (let i = lead - 1; i >= 0; i--) {
    const day = prevTotal - i
    cells.push({ date: toIsoDay(prevYear, prevMonth, day), day, weekday: lead - 1 - i, adjacent: true })
  }

  for (let day = 1; day <= total; day++) {
    const weekday = (lead + day - 1) % 7
    cells.push({ date: toIsoDay(year, month, day), day, weekday, adjacent: false })
  }

  // Trailing days from the next month to complete whole weeks.
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    cells.push({ date: toIsoDay(nextYear, nextMonth, nextDay), day: nextDay, weekday: cells.length % 7, adjacent: true })
    nextDay++
  }

  return { year, month, cells }
}

/** Weeks of the visible grid, grouped by 7. */
export function weeksOf(grid: MonthGrid): DayCell[][] {
  const out: DayCell[][] = []
  for (let i = 0; i < grid.cells.length; i += 7) out.push(grid.cells.slice(i, i + 7))
  return out
}

/** Sunday-start week containing `iso`. Returns 7 ISO days. */
export function weekOf(iso: string): string[] {
  const { year, month, day, weekday } = parseIsoDay(iso)
  const start = addDays(toIsoDay(year, month, day), -weekday)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Adds `n` days to an ISO day string. */
export function addDays(iso: string, n: number): string {
  const { year, month, day } = parseIsoDay(iso)
  const d = new Date(Date.UTC(year, month - 1, day))
  d.setUTCDate(d.getUTCDate() + n)
  return toIsoDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/** `YYYY-MM` of an ISO day. */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7)
}

/** Today as `YYYY-MM-DD` in the local timezone. */
export function todayIso(): string {
  const n = new Date()
  return toIsoDay(n.getFullYear(), n.getMonth() + 1, n.getDate())
}

/** Human label: "December 2026". */
export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1] ?? month} ${year}`
}

/** Human label: "Dec 1, 2026". */
export function dayLabel(iso: string): string {
  const { year, month, day, weekday } = parseIsoDay(iso)
  return `${DOW_SHORT[weekday]} · ${MONTHS_SHORT[month - 1]} ${day}, ${year}`
}

/** Human label for a week: "Nov 29 – Dec 5, 2026". */
export function weekLabel(days: string[]): string {
  if (!days.length) return ''
  const a = parseIsoDay(days[0] as string)
  const b = parseIsoDay(days[days.length - 1] as string)
  const left = `${MONTHS_SHORT[a.month - 1]} ${a.day}`
  const right = a.year === b.year ? `${MONTHS_SHORT[b.month - 1]} ${b.day}, ${b.year}` : `${MONTHS_SHORT[b.month - 1]} ${b.day}, ${b.year}`
  return `${left} – ${right}`
}

/** ISO week number (for the "week #n" badge). */
export function isoWeekNumber(iso: string): number {
  const { year, month, day } = parseIsoDay(iso)
  const d = new Date(Date.UTC(year, month - 1, day))
  // Shift to the Thursday of the current ISO week.
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const diff = d.getTime() - firstThursday.getTime()
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000))
}

/** All months of a year, for the year picker. */
export function monthsOfYear(year: number): { year: number; month: number; label: string }[] {
  return MONTHS.map((label, i) => ({ year, month: i + 1, label: `${MONTHS_SHORT[i]} ${year}` }))
}
