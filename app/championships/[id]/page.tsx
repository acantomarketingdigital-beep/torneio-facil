export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FORMAT_LABELS, STATUS_LABELS, STATUS_COLORS, formatDate } from '@/lib/utils'

export default async function ChampionshipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: c } = await supabase.from('championships').select('*').eq('id', id).eq('owner_id', user.id).single()
  if (!c) redirect('/dashboard')

  const [{ count: teamsCount }, { count: matchesCount }, { count: venuesCount }] = await Promise.all([
    supabase.from('teams').select('*', { count: 'exact', head: true }).eq('championship_id', id),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('championship_id', id),
    supabase.from('venues').select('*', { count: 'exact', head: true }).eq('championship_id', id),
  ])

  const { count: finishedCount } = await supabase
    .from('matches').select('*', { count: 'exact', head: true })
    .eq('championship_id', id).eq('status', 'finished')

  const steps = [
    { href: 'teams', label: 'Times', icon: '👥', count: teamsCount, desc: 'Cadastrar times participantes' },
    { href: 'venues', label: 'Quadras', icon: '🏟️', count: venuesCount, desc: 'Cadastrar quadras/campos' },
    { href: 'schedule', label: 'Horários', icon: '📅', count: null, desc: 'Definir datas e horários disponíveis' },
    { href: 'matches', label: 'Jogos', icon: '⚽', count: matchesCount, desc: 'Gerar tabela e lançar resultados' },
    { href: 'standings', label: 'Classificação', icon: '🏅', count: null, desc: 'Ver tabela de classificação' },
    { href: 'settings', label: 'Configurações', icon: '⚙️', count: null, desc: 'Editar regulamento e regras' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium line-clamp-1">{c.name}</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </div>
              <p className="text-gray-500 text-sm">{FORMAT_LABELS[c.format]} · {c.sport}</p>
              {c.start_date && (
                <p className="text-gray-400 text-xs mt-1">{formatDate(c.start_date)} – {formatDate(c.end_date)}</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {c.is_public && c.slug && (
                <Link
                  href={`/c/${c.slug}`}
                  target="_blank"
                  className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                >
                  🔗 Página pública
                </Link>
              )}
              <Link
                href={`/championships/${id}/settings`}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                ⚙️ Editar
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{teamsCount ?? 0}</div>
              <div className="text-xs text-gray-400 mt-0.5">Times</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{matchesCount ?? 0}</div>
              <div className="text-xs text-gray-400 mt-0.5">Jogos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{finishedCount ?? 0}</div>
              <div className="text-xs text-gray-400 mt-0.5">Realizados</div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map(step => (
            <Link
              key={step.href}
              href={`/championships/${id}/${step.href}`}
              className="bg-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all p-5 group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{step.icon}</span>
                {step.count !== null && (
                  <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    {step.count}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                {step.label}
              </h3>
              <p className="text-xs text-gray-400">{step.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
