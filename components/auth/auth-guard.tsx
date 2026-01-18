"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type AuthGuardProps = {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

/**
 * 인증 상태에 따라 리다이렉트를 처리하는 컴포넌트
 * @param requireAuth - 인증이 필요한지 여부 (기본값: true)
 * @param redirectTo - 리다이렉트할 경로 (기본값: /login)
 */
export function AuthGuard({
  children,
  requireAuth = true,
  redirectTo = "/login",
}: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = React.useState(true)

  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (requireAuth && !user) {
          // 인증이 필요한데 사용자가 없으면 로그인 페이지로
          router.push(redirectTo)
          return
        }

        if (!requireAuth && user) {
          // 인증이 필요없는데 사용자가 있으면 메인 페이지로
          if (pathname === "/login" || pathname === "/signup") {
            router.push("/")
            return
          }
        }
      } catch (error) {
        console.error("Auth check error:", error)
        if (requireAuth) {
          router.push(redirectTo)
        }
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()

    // 인증 상태 변화 감지
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 로그인 성공 시 약간의 지연을 두어 로그인 페이지의 리다이렉트 로직과 충돌 방지
      if (requireAuth && !session) {
        router.push(redirectTo)
      } else if (!requireAuth && session) {
        if (pathname === "/login" || pathname === "/signup") {
          // 약간의 지연을 두어 로그인 페이지의 리다이렉트 로직이 먼저 실행되도록 함
          setTimeout(() => {
            router.push("/")
          }, 100)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [requireAuth, redirectTo, router, pathname])

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  return <>{children}</>
}

