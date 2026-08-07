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

const PAKASIR_PROJECT = 'tata-data-dapur'
const PAKASIR_BASE_URL = process.env.PAKASIR_BASE_URL ?? 'https://app.pakasir.com'

type VerifyResult =
  | { ok: true; tx: PakasirPayload }
  | { ok: false; reason: string; status: number }

/**
 * The webhook endpoint is public (middleware skips auth for /api/pakasir/*) and
 * the payload is fully attacker-controllable, so NOTHING in it may be trusted.
 * Before touching any account we call Pakasir back and let Pakasir tell us
 * whether that order really was paid. Fails closed: no API key / unreachable /
 * non-completed → no account is created or modified.
 */
async function verifyWithPakasir(orderId: string, amount: number): Promise<VerifyResult> {
  const apiKey = process.env.PAKASIR_API_KEY
  if (!apiKey) {
    return { ok: false, reason: 'PAKASIR_API_KEY not configured', status: 503 }
  }

  const url =
    `${PAKASIR_BASE_URL}/api/transactiondetail` +
    `?project=${encodeURIComponent(PAKASIR_PROJECT)}` +
    `&amount=${encodeURIComponent(String(amount))}` +
    `&order_id=${encodeURIComponent(orderId)}` +
    `&api_key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    return { ok: false, reason: 'pakasir unreachable', status: 502 }
  }
  if (!res.ok) {
    return { ok: false, reason: `pakasir http ${res.status}`, status: 502 }
  }

  let body: { transaction?: PakasirPayload } & Partial<PakasirPayload>
  try {
    body = await res.json()
  } catch {
    return { ok: false, reason: 'pakasir invalid json', status: 502 }
  }

  const tx = body.transaction ?? (body.order_id ? (body as PakasirPayload) : undefined)
  if (!tx) {
    return { ok: false, reason: 'transaction not found at pakasir', status: 402 }
  }
  if (tx.order_id !== orderId) {
    return { ok: false, reason: 'order_id mismatch', status: 402 }
  }
  if (tx.project !== undefined && tx.project !== PAKASIR_PROJECT) {
    return { ok: false, reason: 'project mismatch', status: 402 }
  }
  if (Number(tx.amount) !== amount) {
    return { ok: false, reason: 'amount mismatch', status: 402 }
  }
  if (tx.status !== 'completed') {
    return { ok: false, reason: `not paid (status=${tx.status})`, status: 402 }
  }

  return { ok: true, tx }
}

function generatePassword(len = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  for (const b of arr) out += chars[b % chars.length]
  return out
}

function credentialsEmailHtml(fullName: string, emailLogin: string, password: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F4EDE0;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid rgba(181,83,42,0.15);">
    <div style="background:#2A1A0E;padding:28px 32px;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#F4EDE0;letter-spacing:-0.3px;">Tata Data Dapur</p>
      <p style="margin:4px 0 0;font-size:12px;color:rgba(244,237,224,0.5);letter-spacing:0.05em;">SISTEM MANAJEMEN DAPUR</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#2A1A0E;">Halo ${fullName} 👋</p>
      <p style="margin:0 0 24px;font-size:14px;color:#5A3D25;line-height:1.7;">
        Terima kasih sudah bergabung dengan Tata Data Dapur! Akun kamu sudah siap digunakan.
      </p>
      <div style="background:#FBF7F2;border:1px solid rgba(181,83,42,0.18);border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#8B7060;letter-spacing:0.1em;text-transform:uppercase;">Kredensial Login</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#7A5C3A;width:90px;vertical-align:top;">URL App</td>
            <td style="padding:6px 0;font-size:13px;">
              <a href="https://app.tatadatadapur.my.id" style="color:#B5532A;font-weight:600;text-decoration:none;">
                app.tatadatadapur.my.id
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#7A5C3A;vertical-align:top;">Email</td>
            <td style="padding:6px 0;font-size:13px;color:#2A1A0E;font-weight:600;">${emailLogin}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#7A5C3A;vertical-align:top;">Password</td>
            <td style="padding:6px 0;font-family:'Courier New',monospace;font-size:16px;color:#B5532A;font-weight:700;letter-spacing:0.08em;">${password}</td>
          </tr>
        </table>
      </div>
      <div style="background:#FFF8F0;border-left:3px solid #B5532A;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#5A3D25;line-height:1.6;">
          <strong>Langkah pertama:</strong> login dan segera ganti password kamu.<br>
          Caranya: buka <strong>Settings → Ganti Password</strong>.
        </p>
      </div>
      <p style="margin:0;font-size:13px;color:#7A5C3A;line-height:1.6;">
        Butuh bantuan? Balas email ini atau hubungi kami via WhatsApp.
      </p>
    </div>
    <div style="background:#F4EDE0;padding:16px 32px;border-top:1px solid rgba(181,83,42,0.1);">
      <p style="margin:0;font-size:12px;color:#8B7060;line-height:1.6;">
        Salam,<br><strong style="color:#5A3D25;">Tim Tata Data Dapur</strong>
      </p>
    </div>
  </div>
</body>
</html>`
}

async function sendCredentialsEmail({
  resendKey,
  toEmail,
  fullName,
  emailLogin,
  password,
}: {
  resendKey: string
  toEmail: string
  fullName: string
  emailLogin: string
  password: string
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Tata Data Dapur <info@tatadatadapur.my.id>',
      to: toEmail,
      subject: 'Akun Tata Data Dapur kamu sudah siap! 🎉',
      html: credentialsEmailHtml(fullName, emailLogin, password),
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
}

export async function POST(req: NextRequest) {
  let payload: PakasirPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { order_id, project, status } = payload

  // Cheap shape filters only — these are hints, never authorization.
  if (project !== PAKASIR_PROJECT) {
    return NextResponse.json({ error: 'unknown project' }, { status: 400 })
  }
  if (typeof order_id !== 'string' || !order_id) {
    return NextResponse.json({ error: 'missing order_id' }, { status: 400 })
  }
  if (status !== 'completed') {
    return NextResponse.json({ ok: true, skipped: 'non-completed status' })
  }

  const supabase = createAdminClient()

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id', order_id)
    .single()

  if (fetchErr || !order) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 })
  }

  if (order.status === 'account_created') {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  // Source of truth: Pakasir, asked with the amount stored in OUR row.
  const verified = await verifyWithPakasir(order_id, order.amount)
  if (!verified.ok) {
    console.error('Pakasir verification failed:', order_id, verified.reason)
    return NextResponse.json({ error: 'payment not verified' }, { status: verified.status })
  }
  const tx = verified.tx

  await supabase
    .from('orders')
    .update({
      status: 'paid',
      paid_at: tx.completed_at ?? new Date().toISOString(),
      pakasir_data: tx,
    })
    .eq('order_id', order_id)

  const password = generatePassword()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const authHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  let userId: string
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email: order.email_login,
      password,
      email_confirm: true,
      user_metadata: { name: order.full_name },
    }),
  })

  if (createRes.ok) {
    const newUser = await createRes.json() as { id: string }
    userId = newUser.id
  } else {
    const listRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(order.email_login)}&page=1&per_page=1`,
      { headers: authHeaders }
    )
    if (!listRes.ok) {
      await supabase.from('orders').update({ generated_password: password }).eq('order_id', order_id)
      return NextResponse.json({ error: 'create user failed and could not fetch existing' }, { status: 500 })
    }
    const { users } = await listRes.json() as { users: Array<{ id: string }> }
    if (!users?.[0]) {
      await supabase.from('orders').update({ generated_password: password }).eq('order_id', order_id)
      return NextResponse.json({ error: 'user not found after create failed' }, { status: 500 })
    }
    userId = users[0].id

    // The email already has an account. Resetting its password is only safe as a
    // retry of THIS order — otherwise a paid order naming someone else's email
    // would hand their account over. Anything else goes to manual review.
    if (order.supabase_user_id !== userId) {
      const { data: priorOrders } = await supabase
        .from('orders')
        .select('order_id')
        .eq('email_login', order.email_login)
        .eq('status', 'account_created')
        .neq('order_id', order_id)
        .limit(1)

      if (priorOrders && priorOrders.length > 0) {
        console.error('Order targets an email already claimed by another order:', order_id)
        await supabase
          .from('orders')
          .update({ status: 'needs_review' })
          .eq('order_id', order_id)
        return NextResponse.json({ error: 'email already has an account' }, { status: 409 })
      }
    }

    await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ password }),
    })
  }

  // The password is stored only as a fallback in case the email below never
  // goes out — it is wiped again the moment delivery succeeds.
  await supabase
    .from('orders')
    .update({
      status: 'account_created',
      generated_password: password,
      supabase_user_id: userId,
      account_created_at: new Date().toISOString(),
    })
    .eq('order_id', order_id)

  // Send credentials email — don't fail if email errors
  const resendKey = process.env.RESEND_API_KEY
  let emailSent = false
  if (resendKey) {
    try {
      await sendCredentialsEmail({
        resendKey,
        toEmail: order.email_notif,
        fullName: order.full_name,
        emailLogin: order.email_login,
        password,
      })
      emailSent = true
    } catch (err) {
      console.error('Email send failed (non-fatal):', err)
    }
  }

  if (emailSent) {
    // Delivered — the customer has it, so we stop keeping a plaintext copy.
    // Admin can still help them later via the resend endpoint, which issues a
    // fresh password instead of reading an old one back.
    await supabase
      .from('orders')
      .update({ generated_password: null })
      .eq('order_id', order_id)
  }

  return NextResponse.json({ ok: true, emailSent })
}
