'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Team, Championship } from '@/types'

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
  const [form, setForm] = useState({ name: '', short_name: '', color: '#3B82F6', contact_name: '', contact_phone: '', seed: '' })

  const load = useCallback(async () => {
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from('championships').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').eq('championship_id', id).order('seed', { ascending: true, nullsFirst: false }).order('name'),
    ])
    setChampionship(c)
    setTeams(t ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setForm({ name: '', short_name: '', color: '#3B82F6', contact_name: '', contact_phone: '', seed: '' })
    setEditing(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)

    const payload = {
      championship_id: id,
      name: form.name.trim(),
      short_name: form.short_name.trim() || null,
      color: form.color,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      seed: form.seed ? Number(form.seed) : null,
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
    setForm({
      name: team.name,
      short_name: team.short_name ?? '',
      color: team.color ?? '#3B82F6',
      contact_name: team.contact_name ?? '',
      contact_phone: team.contact_phone ?? '',
      seed: team.seed?.toString() ?? '',
    })
    setShowForm(true)
  }

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

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-200 p-5 mb-4">
            <h3 className="font-medium text-gray-900 mb-4">{editing ? 'Editar time' : 'Novo time'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nome do time"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Abreviação</label>
                  <input
                    value={form.short_name}
                    onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                    placeholder="Ex: FCB"
                    maxLength={5}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cor</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                    <span className="text-sm text-gray-500">{form.color}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Seed (cabeça de chave)</label>
                  <input type="number" min={1} value={form.seed} onChange={e => setForm(f => ({ ...f, seed: e.target.value }))} placeholder="Ex: 1" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Responsável</label>
                  <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Nome do contato" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
                  <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="(00) 00000-0000" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

        {/* Teams List */}
        <div className="space-y-2">
          {teams.map((team, i) => (
            <div key={team.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: team.color ?? '#3B82F6' }}>
                {team.short_name ?? team.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{team.name}</div>
                {team.contact_name && <div className="text-xs text-gray-400 truncate">{team.contact_name}</div>}
              </div>
              {team.seed && <span className="text-xs text-gray-400">#{team.seed}</span>}
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => startEdit(team)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-xs">✏️</button>
                <button onClick={() => handleDelete(team.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors text-xs">🗑️</button>
              </div>
            </div>
          ))}
          {teams.length === 0 && !showForm && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-sm">Nenhum time cadastrado ainda.</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex gap-3">
          <Link href={`/championships/${id}`} className="flex-1 py-3 text-center text-sm border border-gray-300 rounded-xl hover:bg-gray-50">
            Voltar
          </Link>
          <Link href={`/championships/${id}/venues`} className="flex-1 py-3 text-center text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">
            Próximo: Quadras →
          </Link>
        </div>
      </main>
    </div>
  )
}
