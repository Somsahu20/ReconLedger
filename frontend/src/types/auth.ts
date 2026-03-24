export type User = {
  id: string
  email: string
  full_name: string
  created_at: string
}

export type AuthTokenResponse = {
  access_token: string
  token_type: string
  user: User
}

export type LoginPayload = {
  email: string
  password: string
}

export type RegisterPayload = {
  email: string
  full_name: string
  password: string
}

export type ProfileUpdatePayload = {
  full_name: string
}

export type ChangePasswordPayload = {
  current_password: string
  new_password: string
  confirm_password: string
}
