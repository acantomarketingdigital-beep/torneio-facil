'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Venue } from '@/types'

export default function VenuesPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [venues, setVenues] = useState<Venue[]>([])
  const [champName, setChampName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Venue | null>(null)
  const [form, setForm] = useState({ name: '', description: '', address: '' })

  const load = useCallback(async () => {
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from('championships').select('name').eq('id', id).single(),
      supabase.from('venues').select('*').eq('championship_id', id).order('name'),
    ])
    setChampName(c?.name ?? '')
    setVenues(v ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function reset() {
    setForm({ name: '', description: '', address: '' })
    setEditing(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      championship_id: id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      address: form.address.trim() || null,
    }
    if (editing) {
      await supabase.from('venues').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('venues').insert(payload)
    }
    reset()
    await load()
    setSaving(false)
  }

  async function toggleActive(venue: Venue) {
    await supabase.from('venues').update({ is_active: !venue.is_active }).eq('id', venue.id)
    await load()
  }

  async function handleDelete(venueId: string) {
    if (!confirm('Remover esta quadra?')) return
    await supabase.from('venues').delete().eq('id', venueId)
    await load()
  }

  function startEdit(v: Venue) {
    setEditing(v)
    setForm({ name: v.name, description: v.description ?? '', address: v.address ?? '' })
    setShowForm(true)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={`/championships/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← {champName}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium">Quadras / Campos</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quadras / Campos</h1>
            <p className="text-sm text-gray-400">{venues.length} local(is) cadastrado(s)</p>
          </div>
          <button onClick={() => { reset(); setShowForm(true) }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700 transition-colors">
            + Adicionar
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-200 p-5 mb-4 space-y-3">
            <h3 className="font-medium text-gray-900">{editing ? 'Editar quadra' : 'Nova quadra'}</h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
              <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Quadra 1, Campo Central" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Endereço</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Endereço ou localização" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={reset} className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {venues.map(venue => (
            <div key={venue.id} className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 ${venue.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <span className="text-xl">🏟️</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{venue.name}</div>
                {venue.description && <div className="text-xs text-gray-400 truncate">{venue.description}</div>}
                {venue.address && <div className="text-xs text-gray-400 truncate">{venue.address}</div>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${venue.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {venue.is_active ? 'Ativa' : 'Inativa'}
              </span>
              <div className="flex gap-1">
                <button onClick={() => toggleActive(venue)} className="p-1.5 text-gray-400 hover:text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors text-xs" title="Ativar/Desativar">⚡</button>
                <button onClick={() => startEdit(venue)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-xs">✏️</button>
                <button onClick={() => handleDelete(venue.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors text-xs">🗑️</button>
              </div>
            </div>
          ))}
          {venues.length === 0 && !showForm && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">🏟️</div>
              <p className="text-sm">Nenhuma quadra cadastrada ainda.</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Link href={`/championships/${id}/teams`} className="flex-1 py-3 text-center text-sm border border-gray-300 rounded-xl hover:bg-gray-50">← Times</Link>
          <Link href={`/championships/${id}/schedule`} className="flex-1 py-3 text-center text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Próximo: Horários →</Link>
        </div>
      </main>
    </div>
  )
}
