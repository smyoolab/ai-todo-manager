import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"

// 할 일 생성 스키마 정의
const todoSchema = z.object({
  title: z.string().describe("할 일 제목"),
  description: z.string().optional().describe("할 일 상세 설명 (선택)"),
  due_date: z.string().describe("마감일 (YYYY-MM-DD 형식)"),
  due_time: z.string().optional().describe("마감 시간 (HH:mm 형식, 없으면 기본값 09:00)"),
  priority: z.enum(["high", "medium", "low"]).describe("우선순위"),
  category: z.array(z.string()).default([]).describe("카테고리 배열"),
})

// 입력 전처리 함수
function preprocessInput(input: string): string {
  // 1. 앞뒤 공백 제거
  let processed = input.trim()

  // 2. 연속된 공백을 하나로 통합
  processed = processed.replace(/\s+/g, " ")

  // 3. 특수 문자나 이모지는 그대로 유지 (한글, 영문, 숫자, 일부 특수문자 허용)
  // 이모지와 특수 문자는 할 일 입력에 유용할 수 있으므로 제거하지 않음
  // 대신 나중에 길이 제한으로 관리

  // 4. 대소문자 정규화는 한국어/영어 혼용 환경에서는 필요 없음

  return processed
}

// 입력 검증 함수
function validateInput(input: string): { valid: boolean; error?: string; status?: number } {
  // 빈 문자열 체크
  if (!input || typeof input !== "string") {
    return {
      valid: false,
      error: "자연어 입력이 필요합니다.",
      status: 400,
    }
  }

  const trimmed = input.trim()

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: "입력 내용이 비어있습니다.",
      status: 400,
    }
  }

  // 최소 길이 제한 (2자)
  if (trimmed.length < 2) {
    return {
      valid: false,
      error: "입력은 최소 2자 이상이어야 합니다.",
      status: 400,
    }
  }

  // 최대 길이 제한 (500자)
  if (trimmed.length > 500) {
    return {
      valid: false,
      error: "입력은 최대 500자까지 가능합니다.",
      status: 400,
    }
  }

  return { valid: true }
}

export async function POST(request: Request) {
  try {
    const { naturalLanguageInput } = await request.json()

    // 입력 검증
    const validation = validateInput(naturalLanguageInput)
    if (!validation.valid) {
      return Response.json(
        { success: false, error: validation.error },
        { status: validation.status || 400 }
      )
    }

    // 입력 전처리
    const processedInput = preprocessInput(naturalLanguageInput)

    // API 키 확인
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      console.error("GOOGLE_GENERATIVE_AI_API_KEY 환경 변수가 설정되지 않았습니다.")
      return Response.json(
        { error: "AI 서비스 설정 오류가 발생했습니다." },
        { status: 500 }
      )
    }

    // 현재 날짜/시간 정보를 컨텍스트로 제공
    const now = new Date()
    const today = now.toISOString().split("T")[0] // YYYY-MM-DD
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentDay = now.getDate()
    const currentDayOfWeek = now.getDay() // 0(일요일) ~ 6(토요일)

    // 다음 주 월요일 계산
    const nextMonday = new Date(now)
    const daysUntilNextMonday = (8 - currentDayOfWeek) % 7 || 7
    nextMonday.setDate(now.getDate() + daysUntilNextMonday)
    const nextMondayDate = nextMonday.toISOString().split("T")[0]

    // 이번 주 금요일 계산
    const thisFriday = new Date(now)
    const daysUntilFriday = (5 - currentDayOfWeek + 7) % 7 || 7
    thisFriday.setDate(now.getDate() + daysUntilFriday)
    const thisFridayDate = thisFriday.toISOString().split("T")[0]

    // 내일 날짜
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const tomorrowDate = tomorrow.toISOString().split("T")[0]

    // 모레 날짜
    const dayAfterTomorrow = new Date(now)
    dayAfterTomorrow.setDate(now.getDate() + 2)
    const dayAfterTomorrowDate = dayAfterTomorrow.toISOString().split("T")[0]

    // Gemini API를 통한 구조화된 데이터 생성
    const result = await generateObject({
      model: google("gemini-2.0-flash-lite"),
      schema: todoSchema,
      prompt: `다음 자연어 입력을 분석하여 할 일 데이터로 변환해주세요.

현재 날짜 정보:
- 오늘 날짜: ${today} (${currentYear}년 ${currentMonth}월 ${currentDay}일)
- 현재 시간: ${now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}

입력된 자연어: "${processedInput}"

=== 필수 변환 규칙 ===

1. 제목(title):
   - 핵심 동작이나 목표를 간결하게 추출
   - 불필요한 수식어는 제거

2. 설명(description):
   - 상세한 내용이 있다면 포함 (없으면 생략 가능)

3. 날짜(due_date) - 반드시 다음 규칙을 준수:
   - "오늘" → ${today}
   - "내일" → ${tomorrowDate}
   - "모레" → ${dayAfterTomorrowDate}
   - "이번 주 금요일" → ${thisFridayDate} (가장 가까운 금요일)
   - "다음 주 월요일" → ${nextMondayDate} (다음 주의 월요일)
   - 명시된 날짜가 없으면 ${today} (오늘 날짜) 사용
   - 반드시 YYYY-MM-DD 형식으로 반환 (예: 2026-01-16)

4. 시간(due_time) - 반드시 다음 규칙을 준수:
   - "아침" → 09:00
   - "점심" → 12:00
   - "오후" → 14:00
   - "저녁" → 18:00
   - "밤" → 21:00
   - 구체적인 시간이 있으면 해당 시간을 24시간 형식(HH:mm)으로 변환
   - 시간 정보가 없으면 기본값 09:00 사용
   - 반드시 HH:mm 형식으로 반환 (예: 15:00)

5. 우선순위(priority) - 반드시 다음 키워드를 기준으로 판단:
   - "high": "급하게", "중요한", "빨리", "꼭", "반드시" 등의 키워드가 있으면
   - "medium": "보통", "적당히" 등의 키워드가 있거나 키워드가 없으면
   - "low": "여유롭게", "천천히", "언젠가" 등의 키워드가 있으면
   - 문맥상 긴급해 보이면 "high", 그렇지 않으면 "medium" 기본값

6. 카테고리(category) - 반드시 다음 키워드를 기준으로 분류:
   - "업무": "회의", "보고서", "프로젝트", "업무" 등의 키워드
   - "개인": "쇼핑", "친구", "가족", "개인" 등의 키워드
   - "건강": "운동", "병원", "건강", "요가" 등의 키워드
   - "학습": "공부", "책", "강의", "학습" 등의 키워드
   - 여러 키워드가 있으면 해당하는 카테고리를 모두 포함
   - 명확하지 않으면 ["개인"] 사용
   - 반드시 문자열 배열 형식으로 반환 (예: ["업무"])

=== 출력 형식 ===
반드시 다음 JSON 형식을 준수하여 응답하세요:
{
  "title": "할 일 제목",
  "description": "상세 설명 (선택)",
  "due_date": "YYYY-MM-DD",
  "due_time": "HH:mm",
  "priority": "high" | "medium" | "low",
  "category": ["카테고리1", "카테고리2"]
}

위 규칙을 반드시 준수하여 정확하게 변환해주세요.`,
      temperature: 0.3, // 일관성 있는 결과를 위해 낮은 temperature 사용
    })

    // 결과 검증 및 후처리
    const todoData = result.object

    // 필수 필드 누락 시 기본값 설정
    if (!todoData.title || todoData.title.trim().length === 0) {
      todoData.title = "할 일"
    }

    if (!todoData.due_date) {
      todoData.due_date = today
    }

    if (!todoData.priority) {
      todoData.priority = "medium"
    }

    if (!todoData.category || !Array.isArray(todoData.category)) {
      todoData.category = ["개인"]
    }

    // 제목 후처리 (너무 길거나 짧은 경우 자동 조정)
    const titleMinLength = 1
    const titleMaxLength = 200
    let processedTitle = todoData.title.trim()

    if (processedTitle.length < titleMinLength) {
      processedTitle = "할 일"
    } else if (processedTitle.length > titleMaxLength) {
      processedTitle = processedTitle.substring(0, titleMaxLength) + "..."
    }

    todoData.title = processedTitle

    // 날짜 검증 및 정규화
    try {
      // YYYY-MM-DD 형식 검증
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(todoData.due_date)) {
        // 잘못된 형식이면 오늘 날짜 사용
        todoData.due_date = today
      } else {
        // 날짜 유효성 검증
        const parsedDate = new Date(todoData.due_date + "T00:00:00")
        if (isNaN(parsedDate.getTime())) {
          todoData.due_date = today
        } else {
          // 생성된 날짜가 과거인지 확인 (과거라면 오늘로 조정)
          const todayDate = new Date(today + "T00:00:00")
          if (parsedDate < todayDate) {
            todoData.due_date = today
          }
        }
      }
    } catch (e) {
      todoData.due_date = today
    }

    // 시간 형식 검증 (HH:mm) 및 기본값 설정
    if (!todoData.due_time) {
      todoData.due_time = "09:00"
    } else {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(todoData.due_time)) {
        todoData.due_time = "09:00"
      }
    }

    // 설명 필드 후처리 (있으면 정리)
    if (todoData.description) {
      todoData.description = todoData.description.trim()
      if (todoData.description.length > 1000) {
        todoData.description = todoData.description.substring(0, 1000) + "..."
      }
    }

    return Response.json({
      success: true,
      data: todoData,
    })
  } catch (error: any) {
    console.error("Error generating todo from natural language:", error)

    // 에러 타입에 따른 처리
    let errorMessage = "할 일 생성 중 오류가 발생했습니다."
    let statusCode = 500

    // API 키 오류
    if (error.message?.includes("API key") || error.message?.includes("authentication")) {
      errorMessage = "AI 서비스 인증 오류가 발생했습니다."
      statusCode = 500
    }
    // API 호출 한도 초과 (429)
    else if (
      error.message?.includes("quota") ||
      error.message?.includes("limit") ||
      error.message?.includes("rate limit") ||
      error.status === 429
    ) {
      errorMessage = "AI 서비스 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요."
      statusCode = 429
    }
    // 네트워크 오류
    else if (error.message?.includes("network") || error.message?.includes("fetch") || error.message?.includes("timeout")) {
      errorMessage = "네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요."
      statusCode = 500
    }
    // 잘못된 요청 형식
    else if (error.message?.includes("bad request") || error.status === 400) {
      errorMessage = "잘못된 요청 형식입니다. 입력을 확인해주세요."
      statusCode = 400
    }
    // 그 외 오류
    else {
      errorMessage = "할 일 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
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
