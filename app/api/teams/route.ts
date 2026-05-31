import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data } = await supabase
    .from('registered_teams')
    .select('id, name, category, gender, created_at')
    .eq('user_id', user.id)
    .order('name')

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const teams = await request.json()
  if (!Array.isArray(teams)) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const rows = teams
    .filter(t => t.name?.trim())
    .map(t => ({
      user_id: user.id,
      name: t.name.trim(),
      category: (t.category ?? '').trim(),
      gender: (t.gender ?? '').trim(),
    }))

  if (rows.length === 0) return NextResponse.json({ saved: 0 })

  const { error } = await supabase
    .from('registered_teams')
    .upsert(rows, { onConflict: 'user_id,name,category,gender', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: rows.length })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const { error } = await supabase
    .from('registered_teams')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
