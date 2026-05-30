'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { AvailableSlot, Venue } from '@/types'
import { formatDate, formatTime } from '@/lib/utils'

export default function SchedulePage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [champName, setChampName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ slot_date: '', start_time: '08:00', end_time: '22:00', venue_id: '' })

  const load = useCallback(async () => {
    const [{ data: c }, { data: v }, { data: s }] = await Promise.all([
      supabase.from('championships').select('name').eq('id', id).single(),
      supabase.from('venues').select('*').eq('championship_id', id).eq('is_active', true).order('name'),
      supabase.from('available_slots').select('*, venue:venues(*)').eq('championship_id', id).order('slot_date').order('start_time'),
    ])
    setChampName(c?.name ?? '')
    setVenues(v ?? [])
    setSlots(s ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!form.slot_date || !form.start_time || !form.end_time) return
    setSaving(true)
    await supabase.from('available_slots').insert({
      championship_id: id,
      slot_date: form.slot_date,
      start_time: form.start_time,
      end_time: form.end_time,
      venue_id: form.venue_id || null,
    })
    setShowForm(false)
    setForm(f => ({ ...f, slot_date: '' }))
    await load()
    setSaving(false)
  }

  async function handleDelete(slotId: string) {
    await supabase.from('available_slots').delete().eq('id', slotId)
    await load()
  }

  // Group slots by date
  const grouped = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    if (!acc[slot.slot_date]) acc[slot.slot_date] = []
    acc[slot.slot_date].push(slot)
    return acc
  }, {})

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href={`/championships/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← {champName}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium">Horários Disponíveis</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Horários Disponíveis</h1>
            <p className="text-sm text-gray-400">Defina os dias e horários em que os jogos podem ocorrer</p>
          </div>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium hover:bg-blue-700">
            + Adicionar
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-200 p-5 mb-4 space-y-3">
            <h3 className="font-medium text-gray-900">Novo horário disponível</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
                <input type="date" value={form.slot_date} onChange={e => setForm(f => ({ ...f, slot_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Início</label>
                <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fim</label>
                <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Quadra (opcional)</label>
                <select value={form.venue_id} onChange={e => setForm(f => ({ ...f, venue_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Todas as quadras</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">💡 Se não selecionar uma quadra, o horário será válido para todas as quadras ativas.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={handleAdd} disabled={saving || !form.slot_date} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}

        {Object.keys(grouped).length === 0 && !showForm ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-sm">Nenhum horário definido ainda.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([date, daySlots]) => (
              <div key={date} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="font-medium text-sm text-gray-900">{formatDate(date, 'EEEE, dd/MM/yyyy')}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {daySlots.map(slot => (
                    <div key={slot.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-blue-600">{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</span>
                        {slot.venue ? (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{slot.venue.name}</span>
                        ) : (
                          <span className="text-xs text-gray-400">Todas as quadras</span>
                        )}
                      </div>
                      <button onClick={() => handleDelete(slot.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors text-xs">🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Link href={`/championships/${id}/venues`} className="flex-1 py-3 text-center text-sm border border-gray-300 rounded-xl hover:bg-gray-50">← Quadras</Link>
          <Link href={`/championships/${id}/matches`} className="flex-1 py-3 text-center text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Próximo: Jogos →</Link>
        </div>
      </main>
    </div>
  )
}
