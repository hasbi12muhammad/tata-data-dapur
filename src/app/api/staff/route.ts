import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'edge'

const DOMAIN = 'staff.tatadatadapur.my.id'
const USERNAME_RE = /^[a-z0-9_]{3,20}$/

/** Pemanggil harus owner (bukan karyawan). Token divalidasi ke server Supabase. */
async function getOwner(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const admin = createAdminClient()
  const { data } = await admin.auth.getUser(token)
  const u = data.user
  if (!u || u.app_metadata?.role === 'staff') return null
  return { id: u.id, admin }
}

const err = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status })

// Tambah karyawan: { username, password, display_name? }
export async function POST(req: NextRequest) {
  const owner = await getOwner(req)
  if (!owner) return err('unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  const username = String(body.username ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const displayName = String(body.display_name ?? '').trim().slice(0, 60) || username
  if (!USERNAME_RE.test(username)) return err('Username 3-20 karakter: huruf kecil, angka, _')
  if (password.length < 8) return err('Password minimal 8 karakter')

  const { admin } = owner
  // Baris settings wajib ada (kuota slot dibaca trigger dari sini). Tidak menimpa yang sudah ada.
  await admin.from('staff_settings').upsert({ owner_id: owner.id }, { onConflict: 'owner_id', ignoreDuplicates: true })

  const { data: created, error: e1 } = await admin.auth.admin.createUser({
    email: `${username}@${DOMAIN}`,
    password,
    email_confirm: true,
    app_metadata: { role: 'staff' },
    user_metadata: { name: displayName },
  })
  if (e1 || !created.user) {
    return err(/already|exists|registered/i.test(e1?.message ?? '') ? 'Username sudah dipakai' : 'Gagal membuat akun')
  }

  const { error: e2 } = await admin
    .from('staff_accounts')
    .insert({ owner_id: owner.id, user_id: created.user.id, username, display_name: displayName })
  if (e2) {
    await admin.auth.admin.deleteUser(created.user.id) // jangan tinggalkan akun yatim
    return err(e2.message.includes('Slot karyawan penuh') ? 'Slot karyawan penuh' : e2.code === '23505' ? 'Username sudah dipakai' : 'Gagal menyimpan akun', 409)
  }
  return NextResponse.json({ ok: true })
}

/** Cek akun memang milik owner ini sebelum diubah/dihapus. */
async function ownedStaff(owner: NonNullable<Awaited<ReturnType<typeof getOwner>>>, id: unknown) {
  if (typeof id !== 'string') return null
  const { data } = await owner.admin
    .from('staff_accounts')
    .select('user_id')
    .eq('user_id', id)
    .eq('owner_id', owner.id)
    .maybeSingle()
  return data?.user_id as string | undefined
}

// Ganti password karyawan: { user_id, password }
export async function PATCH(req: NextRequest) {
  const owner = await getOwner(req)
  if (!owner) return err('unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  const id = await ownedStaff(owner, body.user_id)
  if (!id) return err('not found', 404)
  if (String(body.password ?? '').length < 8) return err('Password minimal 8 karakter')
  const { error } = await owner.admin.auth.admin.updateUserById(id, { password: body.password })
  return error ? err('Gagal mengganti password') : NextResponse.json({ ok: true })
}

// Hapus karyawan: { user_id }. staff_accounts ikut terhapus (FK cascade).
export async function DELETE(req: NextRequest) {
  const owner = await getOwner(req)
  if (!owner) return err('unauthorized', 401)
  const body = await req.json().catch(() => ({}))
  const id = await ownedStaff(owner, body.user_id)
  if (!id) return err('not found', 404)
  const { error } = await owner.admin.auth.admin.deleteUser(id)
  return error ? err('Gagal menghapus akun') : NextResponse.json({ ok: true })
}
