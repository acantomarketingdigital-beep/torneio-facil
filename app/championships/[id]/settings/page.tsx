'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Championship } from '@/types'
import { FORMAT_LABELS } from '@/lib/utils'

const TIEBREAKERS = [
  { value: 'points', label: 'Pontos' },
  { value: 'wins', label: 'Vitórias' },
  { value: 'goal_difference', label: 'Saldo de gols' },
  { value: 'goals_for', label: 'Gols marcados' },
  { value: 'goals_against', label: 'Gols sofridos' },
  { value: 'head_to_head', label: 'Confronto direto' },
]

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [champ, setChamp] = useState<Championship | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Championship>>({})
  const [tiebreakers, setTiebreakers] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('championships').select('*').eq('id', id).single()
    setChamp(data)
    setForm(data ?? {})
    setTiebreakers(data?.tiebreaker_order ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function moveTiebreaker(index: number, dir: -1 | 1) {
    const newOrder = [...tiebreakers]
    const swapIndex = index + dir
    if (swapIndex < 0 || swapIndex >= newOrder.length) return
    ;[newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]]
    setTiebreakers(newOrder)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('championships').update({
      ...form,
      tiebreaker_order: tiebreakers,
    }).eq('id', id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Excluir o campeonato "${champ?.name}"? Esta ação não pode ser desfeita.`)) return
    await supabase.from('championships').delete().eq('id', id)
    router.push('/dashboard')
  }

  function update(key: keyof Championship, value: unknown) {
    setForm(f => ({ ...f, [key]: value }))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={`/championships/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← {champ?.name}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium">Configurações</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <h1 className="text-xl font-bold text-gray-900">Configurações do Campeonato</h1>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-900">Informações gerais</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome</label>
            <input value={form.name ?? ''} onChange={e => update('name', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Formato: {FORMAT_LABELS[champ?.format ?? ''] ?? champ?.format}</label>
            <p className="text-xs text-gray-400">O formato só pode ser alterado antes de gerar os jogos.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status ?? ''} onChange={e => update('status', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="in_progress">Em andamento</option>
              <option value="finished">Finalizado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Regulamento</label>
            <textarea
              value={form.regulation ?? ''}
              onChange={e => update('regulation', e.target.value)}
              rows={5}
              placeholder="Descreva as regras e regulamento do campeonato..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_public" checked={form.is_public ?? true} onChange={e => update('is_public', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
            <label htmlFor="is_public" className="text-sm text-gray-700">Página pública ativa</label>
          </div>
        </div>

        {/* Tiebreakers */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-medium text-gray-900 mb-3">Critérios de desempate (em ordem)</h2>
          <div className="space-y-2">
            {tiebreakers.map((tb, i) => {
              const label = TIEBREAKERS.find(t => t.value === tb)?.label ?? tb
              return (
                <div key={tb} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-700">{label}</span>
                  <button onClick={() => moveTiebreaker(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30 text-xs">↑</button>
                  <button onClick={() => moveTiebreaker(i, 1)} disabled={i === tiebreakers.length - 1} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30 text-xs">↓</button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pontuação */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-900">Pontuação</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'points_win', label: 'Vitória' },
              { key: 'points_draw', label: 'Empate' },
              { key: 'points_loss', label: 'Derrota' },
            ].map(p => (
              <div key={p.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{p.label}</label>
                <input type="number" min={0} value={(form as Record<string, unknown>)[p.key] as number ?? 0} onChange={e => update(p.key as keyof Championship, Number(e.target.value))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
        >
          {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar configurações'}
        </button>

        {/* Danger zone */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <h2 className="font-medium text-red-700 mb-2">Zona de perigo</h2>
          <p className="text-sm text-red-600 mb-4">Excluir o campeonato irá apagar permanentemente todos os times, jogos e resultados.</p>
          <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 transition-colors">
            Excluir campeonato
          </button>
        </div>
      </main>
    </div>
  )
}
