import Decimal from 'decimal.js'

export function multiply(a: number | string, b: number | string): string {
  return new Decimal(a).times(b).toString()
}

export function add(a: number | string, b: number | string): string {
  return new Decimal(a).plus(b).toString()
}

export function subtract(a: number | string, b: number | string): string {
  return new Decimal(a).minus(b).toString()
}

export function formatIDR(value: number | string): string {
  const num = new Decimal(value).toNumber()
  return 'Rp' + num.toLocaleString('id-ID', { maximumFractionDigits: 2 })
}
