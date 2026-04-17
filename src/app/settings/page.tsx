"use client";

export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    setEmailSent(false);
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/settings` },
    );
    setEmailLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setEmailSent(true);
      setEmail("");
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPasswordError("Password tidak cocok");
      return;
    }
    setPasswordError("");
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPasswordLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password berhasil diubah");
      setPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <AppLayout title="Pengaturan Akun">
      <div className="max-w-lg mx-auto flex flex-col gap-6">
        {/* Email Section */}
        <div className="bg-[#FBF8F2] rounded-2xl border border-[#D9CCAF] shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#2C1810] mb-1">
            Ganti Email
          </h2>
          <p className="text-sm text-[#7C6352] mb-5">
            Link konfirmasi akan dikirim ke email baru.
          </p>
          {emailSent && (
            <div className="mb-4 rounded-lg bg-[#E9F5E9] border border-[#A8D5A2] px-4 py-3 text-sm text-[#2E6B2E]">
              Cek inbox email baru Anda untuk konfirmasi.
            </div>
          )}
          <form onSubmit={handleEmailUpdate} className="flex flex-col gap-4">
            <Input
              label="Email baru"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@baru.com"
            />
            <Button type="submit" loading={emailLoading} className="self-start">
              Simpan
            </Button>
          </form>
        </div>

        {/* Password Section */}
        <div className="bg-[#FBF8F2] rounded-2xl border border-[#D9CCAF] shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#2C1810] mb-1">
            Ganti Password
          </h2>
          <p className="text-sm text-[#7C6352] mb-5">
            Gunakan password yang kuat dan belum pernah dipakai.
          </p>
          <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-4">
            <Input
              label="Password baru"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
              required
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <Input
              label="Konfirmasi password baru"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError("");
              }}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              error={passwordError}
            />
            <Button
              type="submit"
              loading={passwordLoading}
              className="self-start"
            >
              Simpan
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
