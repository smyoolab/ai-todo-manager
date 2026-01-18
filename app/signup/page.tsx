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

const signupFormSchema = z
  .object({
    name: z.string().min(1, "이름을 입력해주세요."),
    email: z.string().email("올바른 이메일 주소를 입력해주세요."),
    password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
    confirmPassword: z.string().min(6, "비밀번호 확인을 입력해주세요."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })

type SignupFormValues = z.infer<typeof signupFormSchema>

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

  // 전역 이벤트 리스너: 마우스가 버튼 밖에서 떼어지는 경우 처리
  React.useEffect(() => {
    const handleMouseUp = () => {
      setShowPassword(false)
      setShowConfirmPassword(false)
    }

    const handleTouchEnd = () => {
      setShowPassword(false)
      setShowConfirmPassword(false)
    }

    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchend", handleTouchEnd)

    return () => {
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [])

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const supabase = createClient()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            email: data.email,
          },
        },
      })

      if (authError) {
        // 사용자 친화적인 에러 메시지로 변환
        let errorMessage = "회원가입 중 오류가 발생했습니다."
        
        if (authError.message.includes("already registered")) {
          errorMessage = "이미 등록된 이메일입니다."
        } else if (authError.message.includes("invalid email")) {
          errorMessage = "올바른 이메일 주소를 입력해주세요."
        } else if (authError.message.includes("Password")) {
          errorMessage = "비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요."
        } else {
          errorMessage = authError.message || errorMessage
        }
        
        setError(errorMessage)
        return
      }

      // 이메일 확인이 필요한 경우
      if (authData.user && !authData.session) {
        setSuccessMessage(
          "회원가입이 완료되었습니다. 이메일을 확인하여 계정을 활성화해주세요."
        )
        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          router.push("/login")
        }, 3000)
        return
      }

      // 이메일 확인이 필요 없는 경우 (자동 로그인)
      if (authData.session) {
        router.push("/")
        return
      }

      // 예상치 못한 경우
      setError("회원가입 처리 중 예상치 못한 오류가 발생했습니다.")
    } catch (err) {
      console.error("Signup error:", err)
      setError("회원가입 중 오류가 발생했습니다. 다시 시도해주세요.")
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
            <h2 className="text-xl font-semibold">할 일을 더 스마트하게</h2>
            <p className="text-sm text-muted-foreground">
              AI 기반 할 일 관리로 생산성을 높여보세요.
              <br />
              자연어 입력으로 할 일을 자동 생성하고, 일일/주간 분석을 통해
              효율적으로 관리하세요.
            </p>
          </div>
        </div>

        {/* 회원가입 폼 */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">회원가입</CardTitle>
            <CardDescription>
              이메일과 비밀번호를 입력하여 계정을 만드세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                  {successMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="이름을 입력하세요"
                  {...form.register("name")}
                  disabled={isLoading}
                  aria-invalid={!!form.formState.errors.name}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                <InputGroup>
                  <InputGroupInput
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="비밀번호를 다시 입력하세요"
                    {...form.register("confirmPassword")}
                    disabled={isLoading}
                    aria-invalid={!!form.formState.errors.confirmPassword}
                  />
                  <InputGroupButton
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setShowConfirmPassword(true)
                    }}
                    onMouseUp={() => {
                      setShowConfirmPassword(false)
                    }}
                    onMouseLeave={() => {
                      setShowConfirmPassword(false)
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault()
                      setShowConfirmPassword(true)
                    }}
                    onTouchEnd={() => {
                      setShowConfirmPassword(false)
                    }}
                    aria-label="비밀번호 확인 보기 (누르고 있는 동안만 표시)"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </InputGroupButton>
                </InputGroup>
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "회원가입 중..." : "회원가입"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                로그인
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </AuthGuard>
  )
}

