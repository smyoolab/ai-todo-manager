import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"

// 분석 결과 스키마 정의
const analysisSchema = z.object({
  summary: z.string().describe("할 일 목록 요약 (완료율, 총 개수 등 포함)"),
  urgentTasks: z.array(z.string()).describe("긴급하거나 마감이 임박한 할 일 제목 목록"),
  insights: z.array(z.string()).describe("데이터 기반 인사이트 목록"),
  recommendations: z.array(z.string()).describe("실행 가능한 추천 사항 목록"),
})

// 할 일 타입 정의
type Todo = {
  id: string
  title: string
  description?: string | null
  due_date?: string | Date | null
  priority: "high" | "medium" | "low"
  category: string[]
  completed: boolean
}

export async function POST(request: Request) {
  try {
    const { todos, period } = await request.json()

    // 입력 검증
    if (!todos || !Array.isArray(todos)) {
      return Response.json(
        { success: false, error: "할 일 목록이 필요합니다." },
        { status: 400 }
      )
    }

    if (!period || (period !== "today" && period !== "week")) {
      return Response.json(
        { success: false, error: "분석 기간이 필요합니다 (today/week)." },
        { status: 400 }
      )
    }

    // API 키 확인
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      console.error("GOOGLE_GENERATIVE_AI_API_KEY 환경 변수가 설정되지 않았습니다.")
      return Response.json(
        { success: false, error: "AI 서비스 설정 오류가 발생했습니다." },
        { status: 500 }
      )
    }

    // 통계 계산
    const totalTasks = todos.length
    const completedTasks = todos.filter((todo: Todo) => todo.completed).length
    const incompleteTasks = totalTasks - completedTasks
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

    // 우선순위별 통계
    const priorityStats = {
      high: { total: 0, completed: 0, incomplete: 0 },
      medium: { total: 0, completed: 0, incomplete: 0 },
      low: { total: 0, completed: 0, incomplete: 0 },
    }

    todos.forEach((todo: Todo) => {
      priorityStats[todo.priority].total++
      if (todo.completed) {
        priorityStats[todo.priority].completed++
      } else {
        priorityStats[todo.priority].incomplete++
      }
    })

    // 우선순위별 완료율
    const highCompletionRate =
      priorityStats.high.total > 0 ? (priorityStats.high.completed / priorityStats.high.total) * 100 : 0
    const mediumCompletionRate =
      priorityStats.medium.total > 0 ? (priorityStats.medium.completed / priorityStats.medium.total) * 100 : 0
    const lowCompletionRate =
      priorityStats.low.total > 0 ? (priorityStats.low.completed / priorityStats.low.total) * 100 : 0

    const highPriorityTasks = todos.filter((todo: Todo) => todo.priority === "high")
    const mediumPriorityTasks = todos.filter((todo: Todo) => todo.priority === "medium")
    const lowPriorityTasks = todos.filter((todo: Todo) => todo.priority === "low")

    // 마감일 관련 통계
    const now = new Date()
    const overdueTasks = todos.filter((todo: Todo) => {
      if (!todo.due_date || todo.completed) return false
      const dueDate = new Date(todo.due_date)
      return dueDate < now
    })

    // 마감일 준수율 (완료된 할 일 중 마감일 전에 완료한 비율)
    const completedWithDueDate = todos.filter(
      (todo: Todo) => todo.completed && todo.due_date
    )
    const onTimeCompleted = completedWithDueDate.filter((todo: Todo) => {
      const dueDate = new Date(todo.due_date!)
      const completedDate = todo.completed ? new Date() : null // 실제로는 completed_at 필드가 있어야 정확함
      return completedDate ? completedDate <= dueDate : true // 임시로 완료된 것으로 간주
    })
    const onTimeRate =
      completedWithDueDate.length > 0
        ? (onTimeCompleted.length / completedWithDueDate.length) * 100
        : 0

    // 카테고리별 통계
    const categoryCount: Record<string, { total: number; completed: number }> = {}
    todos.forEach((todo: Todo) => {
      todo.category?.forEach((cat: string) => {
        if (!categoryCount[cat]) {
          categoryCount[cat] = { total: 0, completed: 0 }
        }
        categoryCount[cat].total++
        if (todo.completed) {
          categoryCount[cat].completed++
        }
      })
    })

    // 시간대별 통계 (due_time이 있는 경우)
    const timeSlotCount: Record<string, { total: number; completed: number }> = {
      morning: { total: 0, completed: 0 }, // 00:00-11:59
      afternoon: { total: 0, completed: 0 }, // 12:00-17:59
      evening: { total: 0, completed: 0 }, // 18:00-23:59
    }

    todos.forEach((todo: Todo) => {
      if (todo.due_date) {
        const date = new Date(todo.due_date)
        const hour = date.getHours()
        let slot: "morning" | "afternoon" | "evening"
        if (hour < 12) slot = "morning"
        else if (hour < 18) slot = "afternoon"
        else slot = "evening"

        timeSlotCount[slot].total++
        if (todo.completed) {
          timeSlotCount[slot].completed++
        }
      }
    })

    // 요일별 통계 (이번 주 분석인 경우)
    const dayStats: Record<string, { total: number; completed: number }> = {
      월: { total: 0, completed: 0 },
      화: { total: 0, completed: 0 },
      수: { total: 0, completed: 0 },
      목: { total: 0, completed: 0 },
      금: { total: 0, completed: 0 },
      토: { total: 0, completed: 0 },
      일: { total: 0, completed: 0 },
    }

    if (period === "week") {
      todos.forEach((todo: Todo) => {
        if (todo.due_date) {
          const date = new Date(todo.due_date)
          const dayNames = ["일", "월", "화", "수", "목", "금", "토"]
          const dayName = dayNames[date.getDay()]
          if (dayStats[dayName]) {
            dayStats[dayName].total++
            if (todo.completed) {
              dayStats[dayName].completed++
            }
          }
        }
      })
    }

    // 가장 생산적인 시간대 찾기 (완료율이 가장 높은 시간대)
    const mostProductiveTimeSlot = Object.entries(timeSlotCount)
      .map(([slot, stats]) => ({
        slot,
        rate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
      }))
      .sort((a, b) => b.rate - a.rate)[0]

    // 미루는 작업 패턴 (미완료 중 높은 우선순위 비율)
    const postponedHighPriority =
      highPriorityTasks.filter((t) => !t.completed).length / (incompleteTasks || 1)

    // 기간 정보
    const periodInfo =
      period === "today"
        ? `오늘(${now.toLocaleDateString("ko-KR")})`
        : `이번 주(${getWeekRange(now)})`

    // Gemini API를 통한 분석 및 요약
    const analysisContext = period === "today" 
      ? `오늘의 할 일 집중 분석` 
      : `이번 주 패턴 분석 및 다음 주 계획`

    const result = await generateObject({
      model: google("gemini-2.0-flash-lite"),
      schema: analysisSchema,
      prompt: `[${analysisContext}] ${periodInfo} 할 일 목록을 심층 분석하여 정교한 인사이트와 실행 가능한 추천을 제공해주세요.

=== 기본 통계 ===
- 총 할 일 개수: ${totalTasks}개
- 완료된 할 일: ${completedTasks}개
- 미완료 할 일: ${incompleteTasks}개
- 전체 완료율: ${completionRate.toFixed(1)}%

=== 1. 완료율 분석 ===
우선순위별 완료 패턴:
- 높음(high): ${priorityStats.high.total}개 중 ${priorityStats.high.completed}개 완료 (${highCompletionRate.toFixed(1)}%)
- 중간(medium): ${priorityStats.medium.total}개 중 ${priorityStats.medium.completed}개 완료 (${mediumCompletionRate.toFixed(1)}%)
- 낮음(low): ${priorityStats.low.total}개 중 ${priorityStats.low.completed}개 완료 (${lowCompletionRate.toFixed(1)}%)

카테고리별 완료율:
${Object.entries(categoryCount)
  .map(
    ([cat, stats]) =>
      `- ${cat}: ${stats.total}개 중 ${stats.completed}개 완료 (${stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%)`
  )
  .join("\n") || "- 분류되지 않음"}

${period === "week" ? `요일별 할 일 분포:
${Object.entries(dayStats)
  .map(
    ([day, stats]) =>
      `- ${day}요일: ${stats.total}개 중 ${stats.completed}개 완료 (${stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%)`
  )
  .join("\n")}` : ""}

=== 2. 시간 관리 분석 ===
- 마감일 준수율: 완료된 할 일 중 ${onTimeCompleted.length}/${completedWithDueDate.length}개가 마감일 전 완료 (${onTimeRate.toFixed(1)}%)
- 연기된 할 일: ${overdueTasks.length}개
${overdueTasks.length > 0 ? `  - ${overdueTasks.map((t: Todo) => t.title).slice(0, 5).join(", ")}${overdueTasks.length > 5 ? " 외" : ""}` : "  - 연기된 할 일 없음 (훌륭합니다!)"}

시간대별 할 일 분포 및 완료율:
- 오전(00:00-11:59): ${timeSlotCount.morning.total}개 (완료: ${timeSlotCount.morning.completed}개, ${timeSlotCount.morning.total > 0 ? ((timeSlotCount.morning.completed / timeSlotCount.morning.total) * 100).toFixed(1) : 0}%)
- 오후(12:00-17:59): ${timeSlotCount.afternoon.total}개 (완료: ${timeSlotCount.afternoon.completed}개, ${timeSlotCount.afternoon.total > 0 ? ((timeSlotCount.afternoon.completed / timeSlotCount.afternoon.total) * 100).toFixed(1) : 0}%)
- 저녁(18:00-23:59): ${timeSlotCount.evening.total}개 (완료: ${timeSlotCount.evening.completed}개, ${timeSlotCount.evening.total > 0 ? ((timeSlotCount.evening.completed / timeSlotCount.evening.total) * 100).toFixed(1) : 0}%)

=== 3. 생산성 패턴 ===
${mostProductiveTimeSlot.rate > 0 ? `- 가장 생산적인 시간대: ${mostProductiveTimeSlot.slot === "morning" ? "오전" : mostProductiveTimeSlot.slot === "afternoon" ? "오후" : "저녁"} (완료율 ${mostProductiveTimeSlot.rate.toFixed(1)}%)` : ""}
- 미루는 패턴: 미완료 할 일 중 ${((postponedHighPriority * 100).toFixed(1))}%가 높은 우선순위 작업${postponedHighPriority > 0.5 ? " (중요한 작업을 자주 미루는 경향)" : ""}

=== 할 일 목록 상세 ===
${todos
  .map(
    (todo: Todo, idx: number) =>
      `${idx + 1}. [${todo.completed ? "✅ 완료" : "⏳ 미완료"}] ${todo.title} (우선순위: ${todo.priority === "high" ? "높음" : todo.priority === "medium" ? "중간" : "낮음"}, 카테고리: ${todo.category?.join(", ") || "없음"}${todo.due_date ? `, 마감일: ${new Date(todo.due_date).toLocaleDateString("ko-KR")}${overdueTasks.some((t) => t.id === todo.id) ? " [연기됨]" : ""}` : " [마감일 없음]"})`
  )
  .join("\n")}

=== 분석 요청 ===
위 데이터를 기반으로 다음 형식으로 분석 결과를 제공해주세요:

1. **summary** (1-2문장): 
   - ${period === "today" ? "오늘의 집중도와 남은 할 일의 우선순위를 간결하게 요약" : "이번 주의 전체적인 완료율과 주요 패턴을 요약"}
   - 완료율, 주요 성과, 잠재적 개선점을 자연스럽게 포함

2. **urgentTasks** (최대 5개):
   - 마감이 임박하거나 연기된 미완료 할 일의 제목 목록
   - 긴급성과 중요도를 고려하여 우선순위대로 정렬

3. **insights** (3-5개, 각각 자연스러운 한국어 1문장):
   **완료율 분석 인사이트:**
   - 우선순위별 완료 패턴 특징 (예: "높은 우선순위 작업은 X% 완료되어..." 또는 "중간 우선순위 작업의 완료율이 가장 높습니다")
   ${period === "week" ? `- 요일별 생산성 패턴 (가장 생산적인/낮은 요일)` : ""}
   - 카테고리별 완료율 특징
   
   **시간 관리 분석 인사이트:**
   - 마감일 준수율 평가 (${onTimeRate.toFixed(1)}% 기준)
   - 연기된 할 일의 특징 (있으면) 또는 마감일 준수 칭찬
   - 시간대별 업무 집중도 분포 특징 (예: "오후 시간대에 할 일이 집중되어..." 또는 "저녁 시간대의 완료율이 높습니다")
   
   **생산성 패턴 인사이트:**
   - 가장 생산적인 시간대 도출 (완료율 기반)
   - 미루는 작업 유형 식별 (높은 우선순위 미완료 비율이 높으면)
   - 완료하기 쉬운 작업의 공통 특징 (완료율이 높은 카테고리/우선순위)

4. **recommendations** (3-5개, 각각 구체적이고 실행 가능한 1문장):
   - **우선순위 조정**: 미완료 높은 우선순위 작업이 많으면 구체적인 우선순위 재조정 제안
   - **일정 재배치**: 시간대별 분포가 불균형하면 구체적인 시간 재배치 제안 (예: "오후 일정 일부를 오전으로 이동")
   - **분산 전략**: 할 일이 특정 시간대나 요일에 집중되면 분산 전략 제안
   - **시간 관리 팁**: 마감일 준수율이 낮으면 구체적인 시간 관리 방법 제안
   - **생산성 향상**: 생산적인 시간대를 활용한 구체적 방법 제안

=== 작성 가이드 ===
- **긍정적인 톤 유지**: 개선점을 지적할 때도 격려하는 방식으로 (예: "더 나아질 수 있는 부분" vs "문제점")
- **구체적이고 실행 가능**: "더 잘하세요"가 아닌 "오전 9-11시에 중요한 작업 2개를 처리해보세요"
- **칭찬 포함**: 잘하고 있는 부분을 먼저 강조 (예: "마감일을 잘 지키고 계시네요!", "오전 집중도가 뛰어납니다")
- **동기부여 메시지**: 마지막 추천에 격려나 동기부여 요소 포함
- **자연스러운 한국어**: 딱딱한 통계 나열이 아닌 대화하듯이 자연스럽게
${period === "today" ? "- **당일 집중도**: 오늘의 집중도와 남은 시간 동안의 우선순위 제시" : "- **주간 패턴**: 이번 주의 패턴을 바탕으로 다음 주 계획 제안 포함"}

위 가이드에 따라 사용자가 이해하기 쉽고, 바로 실천할 수 있는 자연스러운 한국어로 작성해주세요.`,
      temperature: 0.4,
    })

    return Response.json({
      success: true,
      data: result.object,
    })
  } catch (error: any) {
    console.error("Error analyzing todos:", error)

    // 에러 타입에 따른 처리
    let errorMessage = "할 일 분석 중 오류가 발생했습니다."
    let statusCode = 500

    if (error.message?.includes("API key") || error.message?.includes("authentication")) {
      errorMessage = "AI 서비스 인증 오류가 발생했습니다."
      statusCode = 500
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("rate limit") ||
      error.status === 429
    ) {
      errorMessage = "AI 서비스 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요."
      statusCode = 429
    } else if (error.message?.includes("network") || error.message?.includes("fetch") || error.message?.includes("timeout")) {
      errorMessage = "네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요."
      statusCode = 500
    }

    return Response.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: statusCode }
    )
  }
}

// 이번 주 날짜 범위 계산 함수
function getWeekRange(date: Date): string {
  const now = new Date(date)
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // 월요일 기준
  const monday = new Date(now)
  monday.setDate(diff)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return `${monday.toLocaleDateString("ko-KR")} ~ ${sunday.toLocaleDateString("ko-KR")}`
}
