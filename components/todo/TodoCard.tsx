"use client"

import * as React from "react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Calendar, Edit, Trash2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface Todo {
  id: string
  title: string
  description?: string | null
  created_date: string | Date
  due_date?: string | Date | null
  priority: "high" | "medium" | "low"
  category: string[]
  completed: boolean
}

interface TodoCardProps {
  todo: Todo
  onToggleComplete?: (id: string, completed: boolean) => void
  onEdit?: (todo: Todo) => void
  onDelete?: (id: string) => void
}

const priorityColors = {
  high: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
  low: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
}

const priorityLabels = {
  high: "높음",
  medium: "중간",
  low: "낮음",
}

export function TodoCard({
  todo,
  onToggleComplete,
  onEdit,
  onDelete,
}: TodoCardProps) {
  const isOverdue =
    !todo.completed &&
    todo.due_date &&
    new Date(todo.due_date) < new Date()

  const handleToggleComplete = (checked: boolean) => {
    onToggleComplete?.(todo.id, checked)
  }

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        todo.completed && "opacity-60",
        isOverdue && !todo.completed && "border-red-300 dark:border-red-700"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Checkbox
              checked={todo.completed}
              onCheckedChange={handleToggleComplete}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <CardTitle
                className={cn(
                  "text-base font-semibold",
                  todo.completed && "line-through text-muted-foreground"
                )}
              >
                {todo.title}
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(todo)}
                aria-label="편집"
              >
                <Edit className="size-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(todo.id)}
                aria-label="삭제"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {todo.description && (
          <p
            className={cn(
              "text-sm text-muted-foreground mb-3",
              todo.completed && "line-through"
            )}
          >
            {todo.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              priorityColors[todo.priority]
            )}
          >
            {priorityLabels[todo.priority]}
          </Badge>
          {todo.category && todo.category.length > 0 && (
            <>
              {todo.category.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs">
                  {cat}
                </Badge>
              ))}
            </>
          )}
          {todo.due_date && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs",
                isOverdue && !todo.completed
                  ? "text-red-600 dark:text-red-400 font-medium"
                  : "text-muted-foreground"
              )}
            >
              <Calendar className="size-3" />
              <span>
                {format(new Date(todo.due_date), "yyyy년 MM월 dd일 HH:mm", {
                  locale: ko,
                })}
              </span>
              {isOverdue && !todo.completed && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  지연
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

