"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CheckSquare2, Sparkles, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthGuard } from "@/components/auth/auth-guard"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InputGroup,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const loginFormSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해주세요."),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
})

type LoginFormValues = z.infer<typeof loginFormSchema>

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)

  // 전역 이벤트 리스너: 마우스가 버튼 밖에서 떼어지는 경우 처리
  React.useEffect(() => {
    if (!showPassword) return

    const handleMouseUp = () => {
      setShowPassword(false)
    }

    const handleTouchEnd = () => {
      setShowPassword(false)
    }

    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchend", handleTouchEnd)

    return () => {
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [showPassword])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (authError) {
        // 사용자 친화적인 에러 메시지로 변환
        let errorMessage = "로그인 중 오류가 발생했습니다."
        
        if (authError.message.includes("Invalid login credentials") || 
            authError.message.includes("Email not confirmed")) {
          errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다."
        } else if (authError.message.includes("Email not confirmed")) {
          errorMessage = "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요."
        } else {
          errorMessage = authError.message || errorMessage
        }
        
        setError(errorMessage)
        return
      }

      // 로그인 성공
      if (authData.session) {
        // 세션 정보 갱신 후 완전한 페이지 리로드를 통해 리다이렉트
        await router.refresh()
        window.location.href = "/"
        return
      }

      // 예상치 못한 경우
      setError("로그인 처리 중 예상치 못한 오류가 발생했습니다.")
    } catch (err) {
      console.error("Login error:", err)
      setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthGuard requireAuth={false}>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-8">
        {/* 로고 및 소개 */}
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CheckSquare2 className="size-6" />
            </div>
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-bold">AI Todo</h1>
              <Sparkles className="size-5 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">AI가 도와주는 스마트한 할 일 관리</h2>
            <p className="text-sm text-muted-foreground">
              AI 기반 할 일 관리로 생산성을 높여보세요.
              <br />
              자연어 입력으로 할 일을 자동 생성하고, 일일/주간 분석을 통해
              효율적으로 관리하세요.
            </p>
          </div>
        </div>

        {/* 로그인 폼 */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">로그인</CardTitle>
            <CardDescription>
              이메일과 비밀번호를 입력하여 로그인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  {...form.register("email")}
                  disabled={isLoading}
                  aria-invalid={!!form.formState.errors.email}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <InputGroup>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호를 입력하세요"
                    {...form.register("password")}
                    disabled={isLoading}
                    aria-invalid={!!form.formState.errors.password}
                  />
                  <InputGroupButton
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setShowPassword(true)
                    }}
                    onMouseUp={() => {
                      setShowPassword(false)
                    }}
                    onMouseLeave={() => {
                      setShowPassword(false)
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault()
                      setShowPassword(true)
                    }}
                    onTouchEnd={() => {
                      setShowPassword(false)
                    }}
                    aria-label="비밀번호 보기 (누르고 있는 동안만 표시)"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </InputGroupButton>
                </InputGroup>
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">계정이 없으신가요? </span>
              <Link
                href="/signup"
                className="font-medium text-primary hover:underline"
              >
                회원가입
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </AuthGuard>
  )
}

