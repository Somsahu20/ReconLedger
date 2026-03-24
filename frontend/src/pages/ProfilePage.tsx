import { useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { PageShell } from './PageShell'

export function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth()

  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  async function onSubmitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName.trim()) {
      toast.error('Display name cannot be empty')
      return
    }

    setIsSavingName(true)
    try {
      await updateProfile({ full_name: fullName.trim() })
      toast.success('Profile updated')
    } catch {
      toast.error('Could not update profile')
    } finally {
      setIsSavingName(false)
    }
  }

  async function onSubmitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match')
      return
    }

    setIsSavingPassword(true)
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Could not change password')
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <PageShell title="Profile" description="Manage your account details and password.">
      <div className="grid gap-6 md:grid-cols-2">
        <form className="space-y-4 rounded-2xl border border-(--line) p-5" onSubmit={onSubmitName}>
          <h2 className="text-lg font-semibold text-(--ink)">Account Details</h2>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--muted)">
              Email
            </span>
            <input
              readOnly
              type="email"
              value={user?.email ?? ''}
              className="w-full cursor-not-allowed rounded-xl border border-(--line) bg-slate-50 px-3 py-2.5 text-sm text-(--muted)"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--muted)">
              Display Name
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-xl border border-(--line) px-3 py-2.5 text-sm text-(--ink) outline-none transition focus:border-(--brand) focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <button
            type="submit"
            disabled={isSavingName}
            className="rounded-xl bg-(--brand) px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSavingName ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <form className="space-y-4 rounded-2xl border border-(--line) p-5" onSubmit={onSubmitPassword}>
          <h2 className="text-lg font-semibold text-(--ink)">Change Password</h2>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--muted)">
              Current Password
            </span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-(--line) px-3 py-2.5 text-sm text-(--ink) outline-none transition focus:border-(--brand) focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--muted)">
              New Password
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-(--line) px-3 py-2.5 text-sm text-(--ink) outline-none transition focus:border-(--brand) focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--muted)">
              Confirm Password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-(--line) px-3 py-2.5 text-sm text-(--ink) outline-none transition focus:border-(--brand) focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <button
            type="submit"
            disabled={isSavingPassword}
            className="rounded-xl bg-(--brand) px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSavingPassword ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>
    </PageShell>
  )
}
