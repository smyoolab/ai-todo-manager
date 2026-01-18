"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Sparkles, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { Todo } from "./TodoCard"

const todoFormSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요."),
  description: z.string().optional(),
  due_date: z.string().optional(),
  due_time: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.array(z.string()),
})

export type TodoFormValues = z.infer<typeof todoFormSchema>

interface TodoFormProps {
  todo?: Todo | null
  onSubmit: (data: TodoFormValues) => void | Promise<void>
  onCancel?: () => void
  defaultCategories?: string[]
  className?: string
}

const availableCategories = ["업무", "개인", "학습", "건강", "쇼핑", "기타"]

export function TodoForm({
  todo,
  onSubmit,
  onCancel,
  defaultCategories = availableCategories,
  className,
}: TodoFormProps) {
  const isEditing = !!todo
  const [aiInput, setAiInput] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [aiError, setAiError] = React.useState<string | null>(null)

  const form = useForm<TodoFormValues>({
    resolver: zodResolver(todoFormSchema),
    defaultValues: {
      title: todo?.title || "",
      description: todo?.description || "",
      due_date: todo?.due_date
        ? format(new Date(todo.due_date), "yyyy-MM-dd")
        : "",
      due_time: todo?.due_date
        ? format(new Date(todo.due_date), "HH:mm")
        : "",
      priority: todo?.priority || "medium",
      category: todo?.category ?? [],
    },
  })

  const selectedCategories = form.watch("category")

  // AI 자연어 변환 함수
  const handleAiGenerate = async () => {
    if (!aiInput.trim()) {
      setAiError("자연어 입력이 필요합니다.")
      return
    }

    setIsGenerating(true)
    setAiError(null)

    try {
      const response = await fetch("/api/ai/generate-todo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          naturalLanguageInput: aiInput.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "할 일 생성에 실패했습니다.")
      }

      const todoData = result.data

      // 폼 필드에 자동으로 채우기
      form.setValue("title", todoData.title || "")
      
      // 설명 필드에 AI가 생성한 설명과 원본 자연어 입력을 포함
      const originalInput = aiInput.trim()
      if (todoData.description) {
        // AI가 생성한 설명과 원본 입력을 함께 포함
        form.setValue("description", `${todoData.description}\n\n원본 입력: ${originalInput}`)
      } else {
        // AI가 설명을 생성하지 않은 경우 원본 입력을 설명으로 사용
        form.setValue("description", originalInput)
      }
      if (todoData.due_date) {
        form.setValue("due_date", todoData.due_date)
      }
      if (todoData.due_time) {
        form.setValue("due_time", todoData.due_time)
      } else {
        form.setValue("due_time", "09:00") // 기본값
      }
      if (todoData.priority) {
        form.setValue("priority", todoData.priority as "high" | "medium" | "low")
      }
      if (todoData.category && Array.isArray(todoData.category)) {
        form.setValue("category", todoData.category)
      }

      // AI 입력 필드 초기화
      setAiInput("")
    } catch (error: any) {
      console.error("Error generating todo:", error)
      setAiError(error.message || "할 일 생성 중 오류가 발생했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCategoryToggle = (category: string) => {
    const current = form.getValues("category")
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category]
    form.setValue("category", updated)
  }

  const handleSubmit = async (data: TodoFormValues) => {
    // due_date와 due_time을 결합하여 하나의 날짜 문자열로 만듦
    let combinedDueDate: string | undefined
    if (data.due_date) {
      if (data.due_time) {
        combinedDueDate = `${data.due_date}T${data.due_time}:00`
      } else {
        combinedDueDate = `${data.due_date}T00:00:00`
      }
    }

    await onSubmit({
      ...data,
      due_date: combinedDueDate,
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className={cn("space-y-6", className)}
    >
      {/* AI 자연어 입력 섹션 (수정 모드가 아닐 때만 표시) */}
      {!isEditing && (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <Label htmlFor="ai-input" className="text-sm font-semibold">
              AI 자연어 할 일 생성
            </Label>
          </div>
          <div className="space-y-2">
            <Textarea
              id="ai-input"
              placeholder="예: 내일 오후 3시까지 중요한 팀 회의 준비하기"
              value={aiInput}
              onChange={(e) => {
                setAiInput(e.target.value)
                setAiError(null)
              }}
              rows={2}
              disabled={isGenerating}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAiGenerate}
                disabled={isGenerating || !aiInput.trim()}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    AI로 생성
                  </>
                )}
              </Button>
              {aiError && (
                <p className="text-xs text-destructive">{aiError}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              자연어로 입력하면 자동으로 제목, 날짜, 시간, 우선순위, 카테고리가 채워집니다.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">
          제목 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="할 일 제목을 입력하세요"
        />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">설명</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="할 일에 대한 상세 설명을 입력하세요"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="due_date">마감일</Label>
          <Input
            id="due_date"
            type="date"
            {...form.register("due_date")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_time">마감 시간</Label>
          <Input
            id="due_time"
            type="time"
            {...form.register("due_time")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="priority">우선순위</Label>
        <Select
          value={form.watch("priority")}
          onValueChange={(value: "high" | "medium" | "low") =>
            form.setValue("priority", value)
          }
        >
          <SelectTrigger id="priority">
            <SelectValue placeholder="우선순위를 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">높음</SelectItem>
            <SelectItem value="medium">중간</SelectItem>
            <SelectItem value="low">낮음</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>카테고리</Label>
        <div className="flex flex-wrap gap-2">
          {defaultCategories.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category}`}
                checked={selectedCategories.includes(category)}
                onCheckedChange={() => handleCategoryToggle(category)}
              />
              <Label
                htmlFor={`category-${category}`}
                className="text-sm font-normal cursor-pointer"
              >
                {category}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "저장 중..."
            : isEditing
              ? "수정"
              : "추가"}
        </Button>
      </div>
    </form>
  )
}

