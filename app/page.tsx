"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckSquare2, Sparkles, LogOut, Search, User, Loader2, BarChart3, TrendingUp, AlertCircle, Target, Lightbulb, CheckCircle2, Circle, AlertTriangle, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthGuard } from "@/components/auth/auth-guard"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { TodoForm, TodoList, Todo, type TodoFormValues } from "@/components/todo"
import { cn } from "@/lib/utils"

// 사용자 타입 정의
type User = {
  id: string
  email: string
  name: string
}

type FilterStatus = "all" | "active" | "completed" | "overdue"
type SortOption = "priority" | "due_date" | "created_date" | "title"

export default function Home() {
  const router = useRouter()
  const [todos, setTodos] = React.useState<Todo[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all")
  const [filterPriority, setFilterPriority] = React.useState<string>("all")
  const [sortOption, setSortOption] = React.useState<SortOption>("created_date")
  const [editingTodo, setEditingTodo] = React.useState<Todo | null>(null)
  const [user, setUser] = React.useState<User | null>(null)
  const [isLoadingUser, setIsLoadingUser] = React.useState(true)
  const [isLoadingTodos, setIsLoadingTodos] = React.useState(true)
  const [logoutError, setLogoutError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [deleteTodoId, setDeleteTodoId] = React.useState<string | null>(null)
  
  // AI 분석 관련 state
  const [analysisPeriod, setAnalysisPeriod] = React.useState<"today" | "week">("today")
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [analysisResult, setAnalysisResult] = React.useState<{
    summary: string
    urgentTasks: string[]
    insights: string[]
    recommendations: string[]
  } | null>(null)
  const [analysisError, setAnalysisError] = React.useState<string | null>(null)
  const [todayStats, setTodayStats] = React.useState<{ total: number; completed: number; rate: number; todos: Todo[] } | null>(null)
  const [weekStats, setWeekStats] = React.useState<{ total: number; completed: number; rate: number; todos: Todo[] } | null>(null)

  // 필터링 및 정렬된 할 일 목록
  const filteredAndSortedTodos = React.useMemo(() => {
    let filtered = [...todos]

    // 검색 필터 (제목만 검색)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((todo) =>
        todo.title.toLowerCase().includes(query)
      )
    }

    // 상태 필터
    if (filterStatus === "active") {
      filtered = filtered.filter((todo) => !todo.completed)
    } else if (filterStatus === "completed") {
      filtered = filtered.filter((todo) => todo.completed)
    } else if (filterStatus === "overdue") {
      const now = new Date()
      filtered = filtered.filter(
        (todo) =>
          !todo.completed &&
          todo.due_date &&
          new Date(todo.due_date) < now
      )
    }

    // 우선순위 필터
    if (filterPriority !== "all") {
      filtered = filtered.filter((todo) => todo.priority === filterPriority)
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "priority": {
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          return (
            priorityOrder[b.priority] - priorityOrder[a.priority] ||
            (a.due_date && b.due_date
              ? new Date(a.due_date).getTime() -
                new Date(b.due_date).getTime()
              : 0)
          )
        }
        case "due_date": {
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return (
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
          )
        }
        case "created_date": {
          return (
            new Date(b.created_date).getTime() -
            new Date(a.created_date).getTime()
          )
        }
        case "title": {
          return a.title.localeCompare(b.title, "ko")
        }
        default:
          return 0
      }
    })

    return filtered
  }, [todos, searchQuery, filterStatus, filterPriority, sortOption])

  // Supabase에서 할 일 목록 로드
  const loadTodos = React.useCallback(async () => {
    try {
      setIsLoadingTodos(true)
      setError(null)

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setTodos([])
        return
      }

      // Supabase에서 할 일 목록 조회 (최신순으로 정렬)
      const { data, error: fetchError } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", authUser.id)
        .order("created_date", { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      // 데이터 타입 변환
      const formattedTodos: Todo[] = (data || []).map((todo) => ({
        id: todo.id,
        title: todo.title,
        description: todo.description,
        created_date: todo.created_date,
        due_date: todo.due_date,
        priority: todo.priority as "high" | "medium" | "low",
        category: todo.category || [],
        completed: todo.completed,
      }))

      setTodos(formattedTodos)
    } catch (err: any) {
      console.error("Error loading todos:", err)
      setError(
        err.message === "JWT expired" || err.message?.includes("JWT")
          ? "인증이 만료되었습니다. 다시 로그인해주세요."
          : "할 일 목록을 불러오는 중 오류가 발생했습니다."
      )
    } finally {
      setIsLoadingTodos(false)
    }
  }, [])

  const handleAddTodo = async (data: TodoFormValues) => {
    try {
      setError(null)

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setError("로그인이 필요합니다.")
        return
      }

      // public.users 테이블에 사용자가 존재하는지 확인하고, 없으면 생성
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("id", authUser.id)
        .single()

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116이 아닌 다른 에러인 경우
        console.error("Error checking user:", checkError)
      }

      // 사용자가 존재하지 않으면 생성
      if (!existingUser) {
        const { error: insertUserError } = await supabase.from("users").insert({
          id: authUser.id,
          name: (authUser.user_metadata?.name as string) || "사용자",
          email: authUser.email || "",
        })

        if (insertUserError) {
          console.error("Error creating user profile:", insertUserError)
          // 사용자 생성 실패 시에도 할 일 추가 시도 (트리거가 생성할 수도 있음)
        }
      }

      // Supabase에 할 일 생성
      const { data: insertedData, error: insertError } = await supabase
        .from("todos")
        .insert({
          user_id: authUser.id,
          title: data.title,
          description: data.description || null,
          due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
          priority: data.priority,
          category: data.category || [],
          completed: false,
        })
        .select()

      if (insertError) {
        // 외래 키 제약 조건 위반 오류인 경우 (users 테이블에 사용자가 없는 경우)
        if (
          insertError.message?.includes("foreign key constraint") ||
          insertError.message?.includes("todos_user_id_fkey") ||
          insertError.code === "23503"
        ) {
          // 사용자 프로필 자동 생성 시도
          const { error: insertUserError } = await supabase.from("users").insert({
            id: authUser.id,
            name: (authUser.user_metadata?.name as string) || "사용자",
            email: authUser.email || "",
          })

          if (insertUserError) {
            console.error("Error creating user profile:", insertUserError)
            setError("사용자 프로필이 없습니다. 페이지를 새로고침해주세요.")
            return
          }

          // 사용자 프로필 생성 후 할 일 다시 시도
          const { error: retryInsertError } = await supabase.from("todos").insert({
            user_id: authUser.id,
            title: data.title,
            description: data.description || null,
            due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
            priority: data.priority,
            category: data.category || [],
            completed: false,
          })

          if (retryInsertError) {
            const retryErrorMessage =
              retryInsertError.message ||
              retryInsertError.details ||
              "할 일을 추가하는 중 오류가 발생했습니다."
            setError(retryErrorMessage)
            return
          }

          // 재시도 성공 - 목록 새로고침
          setEditingTodo(null)
          try {
            await loadTodos()
          } catch (loadErr: any) {
            console.warn("할 일 추가 후 목록 새로고침 중 오류:", loadErr)
          }
          return
        }

        // 다른 에러인 경우
        const errorMessage =
          insertError.message ||
          insertError.details ||
          insertError.hint ||
          "할 일을 추가하는 중 오류가 발생했습니다."

        console.error("Error inserting todo:", {
          error: insertError,
          message: errorMessage,
          code: insertError.code,
          details: insertError.details,
        })

        setError(
          errorMessage === "JWT expired" ||
            errorMessage?.includes("JWT") ||
            errorMessage?.includes("expired")
            ? "인증이 만료되었습니다. 다시 로그인해주세요."
            : errorMessage
        )
        return
      }

      // 할 일 추가 성공 - 목록 다시 로드 (에러가 발생해도 할 일은 추가되었으므로 계속 진행)
      setEditingTodo(null)

      try {
        await loadTodos()
      } catch (loadErr: any) {
        // loadTodos에서 에러가 발생해도 할 일 추가는 성공했으므로
        // 에러를 무시하고 계속 진행 (loadTodos 내부에서 이미 에러 처리됨)
        console.warn("할 일 추가 후 목록 새로고침 중 오류:", loadErr)
      }
    } catch (err: any) {
      // 예상치 못한 에러 처리
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        (typeof err === "string" ? err : "할 일을 추가하는 중 오류가 발생했습니다.")

      console.error("Unexpected error adding todo:", {
        error: err,
        errorType: typeof err,
        errorKeys: err ? Object.keys(err) : [],
        message: errorMessage,
        code: err?.code,
        details: err?.details,
      })

      setError(
        errorMessage === "JWT expired" ||
          errorMessage?.includes("JWT") ||
          errorMessage?.includes("expired")
          ? "인증이 만료되었습니다. 다시 로그인해주세요."
          : errorMessage || "할 일을 추가하는 중 오류가 발생했습니다."
      )
    }
  }

  const handleUpdateTodo = async (data: TodoFormValues) => {
    if (!editingTodo) return

    try {
      setError(null)

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setError("로그인이 필요합니다.")
        return
      }

      // Supabase에서 할 일 수정
      const { error: updateError } = await supabase
        .from("todos")
        .update({
          title: data.title,
          description: data.description || null,
          due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
          priority: data.priority,
          category: data.category || [],
        })
        .eq("id", editingTodo.id)
        .eq("user_id", authUser.id) // 본인 소유 확인

      if (updateError) {
        throw updateError
      }

      // 목록 다시 로드
      await loadTodos()
      setEditingTodo(null)
    } catch (err: any) {
      console.error("Error updating todo:", err)
      setError(
        err.message === "JWT expired" || err.message?.includes("JWT")
          ? "인증이 만료되었습니다. 다시 로그인해주세요."
          : "할 일을 수정하는 중 오류가 발생했습니다."
      )
    }
  }

  const handleDeleteTodo = async (id: string) => {
    try {
      setError(null)

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setError("로그인이 필요합니다.")
        return
      }

      // Supabase에서 할 일 삭제
      const { error: deleteError } = await supabase
        .from("todos")
        .delete()
        .eq("id", id)
        .eq("user_id", authUser.id) // 본인 소유 확인

      if (deleteError) {
        throw deleteError
      }

      // 목록 다시 로드
      await loadTodos()
      setDeleteTodoId(null)
    } catch (err: any) {
      console.error("Error deleting todo:", err)
      setError(
        err.message === "JWT expired" || err.message?.includes("JWT")
          ? "인증이 만료되었습니다. 다시 로그인해주세요."
          : "할 일을 삭제하는 중 오류가 발생했습니다."
      )
      setDeleteTodoId(null)
    }
  }

  const handleToggleComplete = async (id: string, completed: boolean) => {
    try {
      setError(null)

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setError("로그인이 필요합니다.")
        return
      }

      // Supabase에서 할 일 완료 상태 업데이트
      const { error: updateError } = await supabase
        .from("todos")
        .update({ completed })
        .eq("id", id)
        .eq("user_id", authUser.id) // 본인 소유 확인

      if (updateError) {
        throw updateError
      }

      // 목록 다시 로드
      await loadTodos()
    } catch (err: any) {
      console.error("Error toggling todo:", err)
      setError(
        err.message === "JWT expired" || err.message?.includes("JWT")
          ? "인증이 만료되었습니다. 다시 로그인해주세요."
          : "할 일 상태를 업데이트하는 중 오류가 발생했습니다."
      )
    }
  }

  const handleDeleteClick = (id: string) => {
    setDeleteTodoId(id)
  }

  const handleDeleteConfirm = () => {
    if (deleteTodoId) {
      handleDeleteTodo(deleteTodoId)
    }
  }

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo)
  }

  const handleCancelEdit = () => {
    setEditingTodo(null)
  }

  // 사용자 정보 및 할 일 목록 로드
  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
          return
        }

        // public.users 테이블에서 사용자 정보 가져오기
        const { data: userData, error } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("id", authUser.id)
          .single()

        if (error) {
          // users 테이블에 데이터가 없는 경우 (초기 회원가입 시 발생 가능)
          // 또는 다른 에러인 경우 auth.users의 기본 정보 사용
          if (error.code === "PGRST116") {
            // 데이터가 없는 경우 - auth.users에서 기본 정보 사용
            setUser({
              id: authUser.id,
              email: authUser.email || "",
              name: (authUser.user_metadata?.name as string) || "사용자",
            })
          } else {
            // 기타 에러의 경우에도 auth.users에서 기본 정보 사용
            setUser({
              id: authUser.id,
              email: authUser.email || "",
              name: (authUser.user_metadata?.name as string) || "사용자",
            })
          }
        } else if (userData) {
          setUser({
            id: userData.id,
            email: userData.email,
            name: userData.name,
          })
        } else {
          // 데이터가 없는 경우 기본 정보 사용
          setUser({
            id: authUser.id,
            email: authUser.email || "",
            name: (authUser.user_metadata?.name as string) || "사용자",
          })
        }
      } catch (err) {
        console.error("Error loading user:", err)
      } finally {
        setIsLoadingUser(false)
      }
    }

    loadUser()
    loadTodos() // 할 일 목록 로드

    // 인증 상태 변화 감지하여 사용자 정보 및 할 일 목록 갱신
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        router.push("/login")
      } else if (event === "SIGNED_IN" && session?.user) {
        loadUser()
        loadTodos()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, loadTodos])

  // AI 할 일 분석 함수
  const handleAnalyzeTodos = async (period: "today" | "week") => {
    setIsAnalyzing(true)
    setAnalysisError(null)
    setAnalysisResult(null)

    try {
      // 기간에 맞는 할 일 목록 필터링
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart)
      todayEnd.setDate(todayEnd.getDate() + 1)

      let filteredTodos: Todo[]

      if (period === "today") {
        // 오늘의 할 일만 필터링
        filteredTodos = todos.filter((todo) => {
          if (!todo.due_date) return false
          const dueDate = new Date(todo.due_date)
          return dueDate >= todayStart && dueDate < todayEnd
        })
      } else {
        // 이번 주의 할 일 필터링 (월요일~일요일)
        const dayOfWeek = now.getDay()
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const weekStart = new Date(now.getFullYear(), now.getMonth(), diff)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        filteredTodos = todos.filter((todo) => {
          if (!todo.due_date) return false
          const dueDate = new Date(todo.due_date)
          return dueDate >= weekStart && dueDate < weekEnd
        })
      }

      if (filteredTodos.length === 0) {
        setAnalysisError(`분석할 할 일이 없습니다.`)
        return
      }

      const response = await fetch("/api/ai/analyze-todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          todos: filteredTodos,
          period,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "할 일 분석에 실패했습니다.")
      }

      setAnalysisResult(result.data)
      
      // 통계 저장 (UI 표시용)
      const completedCount = filteredTodos.filter((t) => t.completed).length
      const completionRate = filteredTodos.length > 0 ? (completedCount / filteredTodos.length) * 100 : 0
      if (period === "today") {
        setTodayStats({ total: filteredTodos.length, completed: completedCount, rate: completionRate, todos: filteredTodos })
      } else {
        setWeekStats({ total: filteredTodos.length, completed: completedCount, rate: completionRate, todos: filteredTodos })
      }
    } catch (err: any) {
      console.error("Error analyzing todos:", err)
      setAnalysisError(err.message || "할 일 분석 중 오류가 발생했습니다.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleLogout = async () => {
    setLogoutError(null)
    
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()

      if (error) {
        setLogoutError("로그아웃 중 오류가 발생했습니다.")
        console.error("Logout error:", error)
        return
      }

      // 로그아웃 성공 시 세션 제거 후 완전한 페이지 리로드를 통해 로그인 페이지로 이동
      await router.refresh()
      window.location.href = "/login"
    } catch (err) {
      console.error("Logout error:", err)
      setLogoutError("로그아웃 중 오류가 발생했습니다.")
    }
  }

  return (
    <AuthGuard requireAuth={true}>
      <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CheckSquare2 className="size-5" />
            </div>
            <div className="flex items-center gap-1">
              <h1 className="text-xl font-bold">AI Todo</h1>
              <Sparkles className="size-4 text-primary" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isLoadingUser ? (
              <div className="text-sm text-muted-foreground">로딩 중...</div>
            ) : user ? (
              <>
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback>
                      <User className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden flex-col sm:flex">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="size-4 mr-2" />
                  로그아웃
                </Button>
                {logoutError && (
                  <div className="text-xs text-destructive">{logoutError}</div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b bg-muted/40">
        <div className="container px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* 검색 */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="할 일 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 필터 및 정렬 */}
            <div className="flex flex-wrap gap-2">
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="상태 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="active">진행 중</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="overdue">지연</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterPriority}
                onValueChange={setFilterPriority}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="우선순위 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">중간</SelectItem>
                  <SelectItem value="low">낮음</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortOption}
                onValueChange={(value) => setSortOption(value as SortOption)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="정렬 기준" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">우선순위순</SelectItem>
                  <SelectItem value="due_date">마감일순</SelectItem>
                  <SelectItem value="created_date">생성일순</SelectItem>
                  <SelectItem value="title">제목순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <main className="container flex-1 px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* TodoForm 영역 */}
          <div className="lg:sticky lg:top-20 lg:h-fit">
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold">
                {editingTodo ? "할 일 수정" : "할 일 추가"}
              </h2>
              <TodoForm
                todo={editingTodo}
                onSubmit={editingTodo ? handleUpdateTodo : handleAddTodo}
                onCancel={editingTodo ? handleCancelEdit : undefined}
              />
            </Card>
          </div>

          {/* TodoList 영역 */}
          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                할 일 목록 ({filteredAndSortedTodos.length})
              </h2>
            </div>
            {isLoadingTodos ? (
              <div className="flex items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">할 일 목록을 불러오는 중...</p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-center">
                <p className="text-destructive">{error}</p>
              </div>
            ) : (
              <TodoList
                todos={filteredAndSortedTodos}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEditTodo}
                onDelete={handleDeleteClick}
                emptyMessage="할 일이 없습니다. 새로운 할 일을 추가해보세요!"
              />
            )}
          </div>
        </div>

        {/* AI 요약 및 분석 섹션 */}
        <div className="mt-8">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">AI 요약 및 분석</h2>
            </div>
            <Tabs
              value={analysisPeriod}
              onValueChange={(value) => setAnalysisPeriod(value as "today" | "week")}
            >
              <TabsList>
                <TabsTrigger value="today">오늘의 요약</TabsTrigger>
                <TabsTrigger value="week">이번 주 요약</TabsTrigger>
              </TabsList>
              <TabsContent value="today" className="mt-4 space-y-4">
                {(!todayStats || !analysisResult || analysisPeriod !== "today") && !isAnalyzing ? (
                  <Button
                    onClick={() => handleAnalyzeTodos("today")}
                    disabled={isAnalyzing}
                    className="gap-2"
                  >
                    <Sparkles className="size-4" />
                    AI 요약 보기
                  </Button>
                ) : null}

                {isAnalyzing && analysisPeriod === "today" && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">오늘의 할 일을 분석하고 있습니다...</p>
                  </div>
                )}

                {analysisPeriod === "today" && analysisError && (
                  <Card className="p-6 border-destructive/50">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="size-5" />
                        <h3 className="font-semibold">오류 발생</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{analysisError}</p>
                      <Button
                        variant="outline"
                        onClick={() => handleAnalyzeTodos("today")}
                        className="gap-2 w-fit"
                      >
                        <RefreshCw className="size-4" />
                        재시도
                      </Button>
                    </div>
                  </Card>
                )}

                {analysisPeriod === "today" && analysisResult && todayStats && (
                  <div className="space-y-6">
                    {/* 완료율 시각화 */}
                    <Card className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <TrendingUp className="size-5 text-primary" />
                            오늘의 완료율
                          </h3>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-primary">{todayStats.rate.toFixed(0)}%</div>
                            <div className="text-sm text-muted-foreground">
                              {todayStats.completed}개 / {todayStats.total}개 완료
                            </div>
                          </div>
                        </div>
                        <Progress value={todayStats.rate} className="h-3" />
                      </div>
                    </Card>

                    {/* 남은 할 일 목록 및 우선순위 */}
                    {todayStats.todos.filter((t) => !t.completed).length > 0 && (
                      <Card className="p-6">
                        <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
                          <AlertTriangle className="size-5 text-amber-500" />
                          남은 할 일 ({todayStats.todos.filter((t) => !t.completed).length}개)
                        </h3>
                        <div className="space-y-2">
                          {todayStats.todos
                            .filter((t) => !t.completed)
                            .sort((a, b) => {
                              const priorityOrder = { high: 3, medium: 2, low: 1 }
                              return priorityOrder[b.priority] - priorityOrder[a.priority]
                            })
                            .map((todo) => (
                              <div
                                key={todo.id}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-lg border",
                                  todo.priority === "high" && "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20",
                                  todo.priority === "medium" && "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20",
                                  todo.priority === "low" && "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"
                                )}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {todo.priority === "high" ? (
                                    <Circle className="size-4 text-red-500 shrink-0" />
                                  ) : todo.priority === "medium" ? (
                                    <Circle className="size-4 text-yellow-500 shrink-0" />
                                  ) : (
                                    <Circle className="size-4 text-blue-500 shrink-0" />
                                  )}
                                  <span className="text-sm font-medium truncate">{todo.title}</span>
                                </div>
                                <Badge
                                  variant={todo.priority === "high" ? "destructive" : todo.priority === "medium" ? "outline" : "secondary"}
                                  className="shrink-0"
                                >
                                  {todo.priority === "high" ? "높음" : todo.priority === "medium" ? "중간" : "낮음"}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </Card>
                    )}

                    {/* AI 분석 결과 */}
                    <div className="space-y-4">
                      {analysisResult.summary && (
                        <Card className="p-6">
                          <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                            <Lightbulb className="size-5 text-primary" />
                            요약
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{analysisResult.summary}</p>
                        </Card>
                      )}

                      {analysisResult.urgentTasks.length > 0 && (
                        <Card className="p-6 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                          <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                            <AlertTriangle className="size-5 text-amber-600" />
                            ⚠️ 긴급 할 일
                          </h3>
                          <ul className="space-y-2">
                            {analysisResult.urgentTasks.map((task, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <span className="text-amber-600 mt-0.5">•</span>
                                <span className="text-muted-foreground">{task}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      )}

                      {analysisResult.insights.length > 0 && (
                        <div className="grid gap-4 md:grid-cols-2">
                          {analysisResult.insights.map((insight, idx) => (
                            <Card key={idx} className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">💡</div>
                                <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}

                      {analysisResult.recommendations.length > 0 && (
                        <Card className="p-6 border-primary/20 bg-primary/5">
                          <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                            <Target className="size-5 text-primary" />
                            🎯 추천 사항
                          </h3>
                          <ul className="space-y-3">
                            {analysisResult.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-sm">
                                <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                                <span className="text-muted-foreground leading-relaxed">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="week" className="mt-4 space-y-4">
                {(!weekStats || !analysisResult || analysisPeriod !== "week") && !isAnalyzing ? (
                  <Button
                    onClick={() => handleAnalyzeTodos("week")}
                    disabled={isAnalyzing}
                    className="gap-2"
                  >
                    <Sparkles className="size-4" />
                    AI 요약 보기
                  </Button>
                ) : null}

                {isAnalyzing && analysisPeriod === "week" && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">이번 주 할 일을 분석하고 있습니다...</p>
                  </div>
                )}

                {analysisPeriod === "week" && analysisError && (
                  <Card className="p-6 border-destructive/50">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="size-5" />
                        <h3 className="font-semibold">오류 발생</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{analysisError}</p>
                      <Button
                        variant="outline"
                        onClick={() => handleAnalyzeTodos("week")}
                        className="gap-2 w-fit"
                      >
                        <RefreshCw className="size-4" />
                        재시도
                      </Button>
                    </div>
                  </Card>
                )}

                {analysisPeriod === "week" && analysisResult && weekStats && (
                  <div className="space-y-6">
                    {/* 주간 완료율 및 트렌드 */}
                    <Card className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <TrendingUp className="size-5 text-primary" />
                            이번 주 완료율
                          </h3>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-primary">{weekStats.rate.toFixed(0)}%</div>
                            <div className="text-sm text-muted-foreground">
                              {weekStats.completed}개 / {weekStats.total}개 완료
                            </div>
                          </div>
                        </div>
                        <Progress value={weekStats.rate} className="h-3" />
                      </div>
                    </Card>

                    {/* 요일별 생산성 패턴 */}
                    {(() => {
                      const now = new Date()
                      const dayOfWeek = now.getDay()
                      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
                      const weekStart = new Date(now.getFullYear(), now.getMonth(), diff)
                      const dayStats: Record<string, { total: number; completed: number }> = {
                        월: { total: 0, completed: 0 },
                        화: { total: 0, completed: 0 },
                        수: { total: 0, completed: 0 },
                        목: { total: 0, completed: 0 },
                        금: { total: 0, completed: 0 },
                        토: { total: 0, completed: 0 },
                        일: { total: 0, completed: 0 },
                      }

                      weekStats.todos.forEach((todo) => {
                        if (todo.due_date) {
                          const date = new Date(todo.due_date)
                          const dayNames = ["일", "월", "화", "수", "목", "금", "토"]
                          const dayName = dayNames[date.getDay()]
                          if (dayName && dayStats[dayName]) {
                            dayStats[dayName].total++
                            if (todo.completed) {
                              dayStats[dayName].completed++
                            }
                          }
                        }
                      })

                      return (
                        <Card className="p-6">
                          <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
                            <BarChart3 className="size-5 text-primary" />
                            요일별 생산성 패턴
                          </h3>
                          <div className="space-y-3">
                            {Object.entries(dayStats)
                              .filter(([_, stats]) => stats.total > 0)
                              .map(([day, stats]) => {
                                const rate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
                                return (
                                  <div key={day} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="font-medium">{day}요일</span>
                                      <span className="text-muted-foreground">
                                        {stats.completed}/{stats.total} ({rate.toFixed(0)}%)
                                      </span>
                                    </div>
                                    <Progress value={rate} className="h-2" />
                                  </div>
                                )
                              })}
                          </div>
                        </Card>
                      )
                    })()}

                    {/* AI 분석 결과 */}
                    <div className="space-y-4">
                      {analysisResult.summary && (
                        <Card className="p-6">
                          <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                            <Lightbulb className="size-5 text-primary" />
                            주간 요약
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{analysisResult.summary}</p>
                        </Card>
                      )}

                      {analysisResult.urgentTasks.length > 0 && (
                        <Card className="p-6 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                          <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                            <AlertTriangle className="size-5 text-amber-600" />
                            ⚠️ 긴급 할 일
                          </h3>
                          <ul className="space-y-2">
                            {analysisResult.urgentTasks.map((task, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <span className="text-amber-600 mt-0.5">•</span>
                                <span className="text-muted-foreground">{task}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      )}

                      {analysisResult.insights.length > 0 && (
                        <div className="grid gap-4 md:grid-cols-2">
                          {analysisResult.insights.map((insight, idx) => (
                            <Card key={idx} className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">💡</div>
                                <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}

                      {analysisResult.recommendations.length > 0 && (
                        <Card className="p-6 border-primary/20 bg-primary/5">
                          <h3 className="mb-3 text-lg font-semibold flex items-center gap-2">
                            <Target className="size-5 text-primary" />
                            🎯 다음 주 계획 및 추천 사항
                          </h3>
                          <ul className="space-y-3">
                            {analysisResult.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-sm">
                                <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                                <span className="text-muted-foreground leading-relaxed">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </main>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteTodoId} onOpenChange={(open) => !open && setDeleteTodoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>할 일 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 할 일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTodoId(null)}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </AuthGuard>
  )
}
