import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../data/firebase'

type Props = {
  displayName: string | null
  // 표시 이름이 바뀌면 값이 달라져 재렌더를 보장한다.
  profileVersion: number
}

export default function EventListPage({ displayName }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // user 객체가 제자리에서 갱신되므로 렌더 시점에 현재 값을 읽는다.
  const name = auth.currentUser?.displayName ?? displayName

  async function handleSignOut() {
    setSubmitting(true)
    setError(null)
    try {
      await signOut(auth)
    } catch {
      setError('로그아웃에 실패했습니다. 다시 시도해 주세요.')
      setSubmitting(false)
    }
  }

  return (
    <main className="card">
      <h1>이벤트 목록</h1>
      <p>{name ? `${name}님 환영합니다.` : '환영합니다.'}</p>
      <p>이벤트 목록은 준비 중입니다.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" onClick={handleSignOut} disabled={submitting}>
        로그아웃
      </button>
    </main>
  )
}
