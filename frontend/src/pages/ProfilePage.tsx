import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Shield, Fingerprint, Lock, LoaderCircle } from 'lucide-react'
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
      toast.error('Identity designation cannot be null')
      return
    }

    setIsSavingName(true)
    try {
      await updateProfile({ full_name: fullName.trim() })
      toast.success('Identity protocols updated successfully')
    } catch {
      toast.error('Identity protocol update failed via API')
    } finally {
      setIsSavingName(false)
    }
  }

  async function onSubmitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (newPassword.length < 8) {
      toast.error('Cryptographic key must exceed 8 entropy units')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Cryptographic key signatures do not match')
      return
    }

    setIsSavingPassword(true)
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      toast.success('Encryption layer rotated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Encryption rotation failed system check')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const inputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-transparent transition-all focus:bg-white/10 focus:ring-(--brand)/50 focus:border-(--brand)/30 backdrop-blur-md"
  const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-widest text-(--muted)"

  return (
    <div className="relative min-h-[calc(100vh-(--spacing(16)))] pb-16 pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-indigo-900/10 via-[#070d1f] to-[#070d1f]" />
      
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <PageShell title="Operator Profile" description="Manage cryptographic identity and securely rotate access credentials.">
          <div className="grid gap-6 md:grid-cols-2 lg:gap-8 max-w-4xl mx-auto pt-6">
            <motion.form 
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="relative overflow-hidden space-y-6 rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 lg:p-8 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] ring-1 ring-white/5 h-fit" 
              onSubmit={onSubmitName}
            >
              <div className="pointer-events-none absolute top-0 right-0 w-32 h-32 bg-(--brand)/10 blur-3xl rounded-full" />
              
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5 relative z-10">
                <div className="h-10 w-10 rounded-[1rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-light tracking-wide text-white">Identity Details</h2>
              </div>

              <div className="space-y-5 relative z-10">
                <label className="block">
                  <span className={labelClass}>
                    Primary Vector (Email)
                  </span>
                  <input
                    readOnly
                    type="email"
                    value={user?.email ?? ''}
                    className="w-full cursor-not-allowed rounded-xl border border-white/5 bg-white/[0.01] px-4 py-3 text-sm text-white/40 ring-1 ring-transparent font-mono"
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>
                    Operator Designation
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className={inputClass}
                    placeholder="Enter active alias..."
                  />
                </label>
              </div>

              <div className="pt-4 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSavingName}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-(--brand)/20 text-(--brand) ring-1 ring-(--brand)/30 px-4 py-3.5 text-[13px] font-semibold tracking-wide uppercase transition-all hover:bg-(--brand)/30 hover:ring-(--brand)/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingName ? (
                    <><LoaderCircle className="h-4 w-4 animate-spin" /> Synchronizing...</>
                  ) : (
                    <><Shield className="h-4 w-4" /> Save Identity</>
                  )}
                </motion.button>
              </div>
            </motion.form>

            <motion.form 
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.1 }}
              className="relative overflow-hidden space-y-6 rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 lg:p-8 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] ring-1 ring-white/5 h-fit" 
              onSubmit={onSubmitPassword}
            >
              <div className="pointer-events-none absolute top-0 left-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full" />

              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5 relative z-10">
                <div className="h-10 w-10 rounded-[1rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Lock className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-light tracking-wide text-white">Cryptographic Rotation</h2>
              </div>

              <div className="space-y-5 relative z-10">
                <label className="block">
                  <span className={labelClass}>
                    Current Node Key
                  </span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className={inputClass}
                    placeholder="Enter current password"
                  />
                </label>

                <div className="pt-2 border-t border-white/5">
                  <label className="block mt-4 mb-5">
                    <span className={labelClass}>
                      New Node Key
                    </span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className={inputClass}
                      placeholder="Minimum 8 characters entropy"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>
                      Verify New Node Key
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className={inputClass}
                      placeholder="Re-enter new password"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500/[0.15] text-amber-500 ring-1 ring-amber-500/30 px-4 py-3.5 text-[13px] font-semibold tracking-wide uppercase transition-all hover:bg-amber-500/25 hover:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-amber-500/[0.15] disabled:hover:ring-amber-500/30"
                >
                  {isSavingPassword ? (
                    <><LoaderCircle className="h-4 w-4 animate-spin" /> Committing Hash...</>
                  ) : (
                    <><Shield className="h-4 w-4" /> Execute Rotation</>
                  )}
                </motion.button>
              </div>
            </motion.form>
          </div>
        </PageShell>
      </div>
    </div>
  )
}
