'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Team, Championship } from '@/types'

const GENDER_OPTIONS = [
  { value: '', label: 'Selecionar...' },
  { value: 'FEM', label: 'Feminino' },
  { value: 'MAS', label: 'Masculino' },
  { value: 'MISTO', label: 'Misto' },
]

const CATEGORY_SUGGESTIONS = ['SUB 12', 'SUB 14', 'SUB 16', 'SUB 18', 'SUB 21', 'ADULTO', 'MASTERS', 'LIVRE']

const GENDER_LABELS: Record<string, string> = { FEM: 'Feminino', MAS: 'Masculino', MISTO: 'Misto' }
const GENDER_COLORS: Record<string, string> = { FEM: 'bg-pink-100 text-pink-700', MAS: 'bg-blue-100 text-blue-700', MISTO: 'bg-purple-100 text-purple-700' }

export default function TeamsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [teams, setTeams] = useState<Team[]>([])
  const [championship, setChampionship] = useState<Championship | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Team | null>(null)
  const [form, setForm] = useState({ name: '', category: '', gender: '' })

  const load = useCallback(async () => {
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from('championships').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').eq('championship_id', id)
        .order('category').order('gender').order('name'),
    ])
    setChampionship(c)
    setTeams(t ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setForm({ name: '', category: '', gender: '' })
    setEditing(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      championship_id: id,
      name: form.name.trim(),
      category: form.category.trim() || null,
      gender: form.gender || null,
      color: '#3B82F6',
    }
    if (editing) {
      await supabase.from('teams').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('teams').insert(payload)
    }
    resetForm()
    await load()
    setSaving(false)
  }

  async function handleDelete(teamId: string) {
    if (!confirm('Remover este time?')) return
    await supabase.from('teams').delete().eq('id', teamId)
    await load()
  }

  function startEdit(team: Team) {
    setEditing(team)
    setForm({ name: team.name, category: team.category ?? '', gender: team.gender ?? '' })
    setShowForm(true)
  }

  // Group teams for display
  const grouped = teams.reduce<Record<string, Team[]>>((acc, t) => {
    const key = [t.category || 'Sem categoria', t.gender || ''].filter(Boolean).join(' · ')
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={`/championships/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← {championship?.name}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium">Times</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Times</h1>
            <p className="text-sm text-gray-400">{teams.length} time(s) cadastrado(s)</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            + Adicionar
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-200 p-5 mb-4">
            <h3 className="font-medium text-gray-900 mb-4">{editing ? 'Editar time' : 'Novo time'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Nome do time"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
                  <input
                    list="categories"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="Ex: SUB 14"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="categories">
                    {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Naipe</label>
                  <select
                    value={form.gender}
                    onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={resetForm} className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar time'}
              </button>
            </div>
          </div>
        )}

        {/* Teams grouped */}
        <div className="space-y-4">
          {Object.entries(grouped).map(([groupKey, groupTeams]) => (
            <div key={groupKey} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="font-medium text-sm text-gray-700">{groupKey}</span>
                <span className="text-xs text-gray-400">{groupTeams.length} time(s)</span>
              </div>
              <div className="divide-y divide-gray-50">
                {groupTeams.map(team => (
                  <div key={team.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">{team.name}</div>
                    </div>
                    {team.gender && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GENDER_COLORS[team.gender] ?? 'bg-gray-100 text-gray-600'}`}>
                        {GENDER_LABELS[team.gender] ?? team.gender}
                      </span>
                    )}
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(team)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 text-xs">✏️</button>
                      <button onClick={() => handleDelete(team.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 text-xs">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {teams.length === 0 && !showForm && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-sm">Nenhum time cadastrado ainda.</p>
              <p className="text-xs mt-1">Adicione os times com Categoria e Naipe para geração automática das chaves.</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Link href={`/championships/${id}`} className="flex-1 py-3 text-center text-sm border border-gray-300 rounded-xl hover:bg-gray-50">
            Voltar
          </Link>
          <Link href={`/championships/${id}/matches`} className="flex-1 py-3 text-center text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">
            Gerar Tabela →
          </Link>
        </div>
      </main>
    </div>
  )
}
