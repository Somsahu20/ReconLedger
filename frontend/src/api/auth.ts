import { api } from './client'
import type {
  AuthTokenResponse,
  ChangePasswordPayload,
  LoginPayload,
  ProfileUpdatePayload,
  RegisterPayload,
  User,
} from '../types/auth'

export async function register(payload: RegisterPayload): Promise<AuthTokenResponse> {
  const { data } = await api.post<AuthTokenResponse>('/auth/register', payload)
  return data
}

export async function login(payload: LoginPayload): Promise<AuthTokenResponse> {
  const { data } = await api.post<AuthTokenResponse>('/auth/login', payload)
  return data
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}

export async function logout(): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/logout')
  return data
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<User> {
  const { data } = await api.put<User>('/auth/me', payload)
  return data
}

export async function changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
  const { data } = await api.put<{ message: string }>('/auth/me/password', payload)
  return data
}
