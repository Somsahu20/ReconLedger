import { createContext } from 'react'
import type {
  ChangePasswordPayload,
  LoginPayload,
  ProfileUpdatePayload,
  RegisterPayload,
  User,
} from '../types/auth'

export type AuthContextValue = {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (payload: ProfileUpdatePayload) => Promise<User>
  changePassword: (payload: ChangePasswordPayload) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
