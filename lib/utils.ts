import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null, pattern = 'dd/MM/yyyy') {
  if (!date) return '-'
  try { return format(parseISO(date), pattern, { locale: ptBR }) }
  catch { return '-' }
}

export function formatTime(time: string | null) {
  if (!time) return '-'
  return time.substring(0, 5)
}

export function formatDateTime(date: string | null, time: string | null) {
  if (!date) return '-'
  const d = formatDate(date)
  const t = time ? ` ${formatTime(time)}` : ''
  return `${d}${t}`
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export const PHASE_LABELS: Record<string, string> = {
  group: 'Fase de Grupos',
  round_robin: 'Todos contra Todos',
  round_of_16: 'Oitavas de Final',
  quarter_final: 'Quartas de Final',
  semi_final: 'Semifinal',
  third_place: 'Disputa de 3º Lugar',
  final: 'Final',
}

export const FORMAT_LABELS: Record<string, string> = {
  auto: 'Automático Inteligente',
  round_robin: 'Todos contra Todos',
  knockout: 'Mata-Mata',
  group_knockout: 'Grupos + Mata-Mata',
  custom: 'Personalizado (X Jogos)',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  in_progress: 'Em andamento',
  finished: 'Finalizado',
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  finished: 'bg-green-100 text-green-700',
}

export const MATCH_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  in_progress: 'Em andamento',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
  walkover: 'W.O.',
}
