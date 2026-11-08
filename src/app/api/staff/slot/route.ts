import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'edge'

const SLOT_PRICE = 50_000
const RETURN_URL = 'https://app.tatadatadapur.my.id/settings?slot=1'

/**
 * Owner beli 1 slot karyawan. Order dibuat server-side (nominal tidak dari klien),
 * slot baru ditambah webhook via grant_staff_slot() setelah status paid.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data } = await admin.auth.getUser(token)
  const u = data.user
  if (!u || u.app_metadata?.role === 'staff') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Sandbox hanya untuk email di BORDERPAY_TEST_EMAILS (dan BORDERPAY_ALLOW_TEST=1).
  const testEmails = (process.env.BORDERPAY_TEST_EMAILS ?? '').toLowerCase().split(',').map((s) => s.trim())
  const test = process.env.BORDERPAY_ALLOW_TEST === '1' && !!u.email && testEmails.includes(u.email.toLowerCase())
  const apiKey = test ? process.env.BORDERPAY_API_KEY_TEST : process.env.BORDERPAY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'payment not configured' }, { status: 503 })

  const rand = crypto.getRandomValues(new Uint16Array(1))[0] % 10000
  const orderId = `TDS-${Date.now()}-${String(rand).padStart(4, '0')}`
  const { error } = await admin.from('orders').insert({
    order_id: orderId,
    full_name: (u.user_metadata?.name as string) || u.email || '-',
    whatsapp: '-',
    email_notif: u.email ?? '-',
    email_login: u.email ?? '-',
    amount: SLOT_PRICE,
    supabase_user_id: u.id,
  })
  if (error) return NextResponse.json({ error: 'gagal membuat order' }, { status: 500 })

  let res: Response
  try {
    res = await fetch('https://borderpay.id/api/v1/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: SLOT_PRICE, reference_id: orderId, return_url: RETURN_URL }),
    })
  } catch {
    return NextResponse.json({ error: 'gateway unreachable' }, { status: 502 })
  }
  const pay = (await res.json().catch(() => ({}))) as { pay_url?: string; checkout_url?: string | null }
  const url = pay.checkout_url || pay.pay_url
  if (!res.ok || !url) {
    console.error('BorderPay create payment failed:', orderId, res.status)
    return NextResponse.json({ error: 'gateway error' }, { status: 502 })
  }
  return NextResponse.json({ url, test })
}
