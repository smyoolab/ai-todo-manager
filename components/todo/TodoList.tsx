"use client"

import * as React from "react"
import { TodoCard, Todo } from "./TodoCard"
import { cn } from "@/lib/utils"

interface TodoListProps {
  todos: Todo[]
  onToggleComplete?: (id: string, completed: boolean) => void
  onEdit?: (todo: Todo) => void
  onDelete?: (id: string) => void
  className?: string
  emptyMessage?: string
}

export function TodoList({
  todos,
  onToggleComplete,
  onEdit,
  onDelete,
  className,
  emptyMessage = "할 일이 없습니다.",
}: TodoListProps) {
  if (todos.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-12 text-center",
          className
        )}
      >
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {todos.map((todo) => (
        <TodoCard
          key={todo.id}
          todo={todo}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

