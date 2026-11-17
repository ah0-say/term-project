import { useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../data/firebase'

function toKoreanAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다.'
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.'
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.'
    case 'auth/network-request-failed':
      return '네트워크 오류입니다. 연결을 확인한 뒤 다시 시도해 주세요.'
    case 'auth/too-many-requests':
      return '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    default:
      return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }
}

type Props = { onProfileUpdated: () => void }

export default function LoginPage({ onProfileUpdated }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isSignup = mode === 'signup'

  function switchMode() {
    setMode(isSignup ? 'login' : 'signup')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)

    const name = displayName.trim()
    if (isSignup && !name) {
      setError('표시 이름을 입력해 주세요.')
      return
    }

    setSubmitting(true)
    try {
      if (isSignup) {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(cred.user, { displayName: name })
        onProfileUpdated()
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      // 성공하면 onAuthStateChanged가 로그인 상태를 반영해 /로 이동한다.
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setError(toKoreanAuthError(code))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="card">
      <h1>{isSignup ? '회원가입' : '로그인'}</h1>
      <form onSubmit={handleSubmit} noValidate>
        {isSignup && (
          <label>
            표시 이름
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          이메일
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? '처리 중…' : isSignup ? '가입하기' : '로그인'}
        </button>
      </form>
      <button
        type="button"
        className="link"
        onClick={switchMode}
        disabled={submitting}
      >
        {isSignup ? '이미 계정이 있나요? 로그인' : '계정이 없나요? 회원가입'}
      </button>
    </main>
  )
}
