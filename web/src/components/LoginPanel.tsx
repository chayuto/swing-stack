import { useState } from 'react'
import type { FormEvent } from 'react'

// Shown only when auto-login is disabled (VITE_AUTO_LOGIN=false) or the
// session is gone. The hosted deployment gets this for free.

interface Props {
  error: string | null
  onSubmit: (email: string, password: string) => void
}

export function LoginPanel({ error, onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(email, password)
  }

  return (
    <div className="panel-center">
      <form className="login-card" onSubmit={submit} data-testid="login-panel">
        <h2>Swing-Stack</h2>
        <p>Sign in to view your telemetry.</p>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="submit" type="submit">
          Sign in
        </button>
        {error && <div className="error" role="alert">{error}</div>}
      </form>
    </div>
  )
}
