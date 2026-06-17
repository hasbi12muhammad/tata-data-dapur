import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'edge'

interface PakasirPayload {
  amount: number
  order_id: string
  project: string
  status: string
  payment_method?: string
  completed_at?: string
}

function generatePassword(len = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  for (const b of arr) out += chars[b % chars.length]
  return out
}

export async function POST(req: NextRequest) {
  let payload: PakasirPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { order_id, amount, project, status } = payload

  if (project !== 'tata-data-dapur') {
    return NextResponse.json({ error: 'unknown project' }, { status: 400 })
  }
  if (status !== 'completed') {
    return NextResponse.json({ ok: true, skipped: 'non-completed status' })
  }

  const supabase = createAdminClient()

  // Fetch order
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id', order_id)
    .single()

  if (fetchErr || !order) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 })
  }
  if (order.amount !== amount) {
    return NextResponse.json({ error: 'amount mismatch' }, { status: 400 })
  }

  // Idempotency: already processed
  if (order.status === 'paid' || order.status === 'account_created') {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  // Mark paid
  await supabase
    .from('orders')
    .update({
      status: 'paid',
      paid_at: payload.completed_at ?? new Date().toISOString(),
      pakasir_data: payload,
    })
    .eq('order_id', order_id)

  // Generate password + create auth user
  const password = generatePassword()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: order.email_login,
      password,
      email_confirm: true,
      user_metadata: { name: order.full_name },
    }),
  })

  if (!createRes.ok) {
    const body = await createRes.text()
    // Save password first even on error so admin can retry manually
    await supabase
      .from('orders')
      .update({ generated_password: password })
      .eq('order_id', order_id)
    return NextResponse.json({ error: `create user failed: ${body}` }, { status: 500 })
  }

  const newUser = await createRes.json() as { id: string }

  await supabase
    .from('orders')
    .update({
      status: 'account_created',
      generated_password: password,
      supabase_user_id: newUser.id,
      account_created_at: new Date().toISOString(),
    })
    .eq('order_id', order_id)

  // TODO: send email credentials to order.email_notif when email provider is set up

  return NextResponse.json({ ok: true })
}
