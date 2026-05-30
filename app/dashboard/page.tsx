export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FORMAT_LABELS, STATUS_LABELS, STATUS_COLORS, formatDate } from '@/lib/utils'
import type { Championship } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: championships } = await supabase
    .from('championships')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-blue-600 text-lg">
            🏆 TorneioFácil
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              Olá, {profile?.full_name?.split(' ')[0] ?? user.email}
            </span>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-sm text-gray-500 hover:text-red-600 transition-colors">
                Sair
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meus Campeonatos</h1>
            <p className="text-gray-500 text-sm mt-1">{championships?.length ?? 0} campeonato(s) criado(s)</p>
          </div>
          <Link
            href="/championships/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            + Novo Campeonato
          </Link>
        </div>

        {/* Empty state */}
        {(!championships || championships.length === 0) && (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Nenhum campeonato ainda</h2>
            <p className="text-gray-400 mb-6 text-sm">Crie seu primeiro campeonato e comece a gerar tabelas automaticamente.</p>
            <Link
              href="/championships/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Criar primeiro campeonato
            </Link>
          </div>
        )}

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {championships?.map((c: Championship) => (
            <Link
              key={c.id}
              href={`/championships/${c.id}`}
              className="bg-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all p-5 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">
                  {c.sport === 'Futebol' ? '⚽' : c.sport === 'Basquete' ? '🏀' : c.sport === 'Vôlei' ? '🏐' : '🎯'}
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </div>
              <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
                {c.name}
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                {FORMAT_LABELS[c.format]} · {c.sport}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{c.start_date ? formatDate(c.start_date) : 'Sem data'}</span>
                {c.is_public && (
                  <span className="flex items-center gap-1 text-green-600">
                    🔗 Público
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
