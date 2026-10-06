import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, jsonError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import type { CompleteTaskResult } from "@/lib/types";

// XP is awarded inside the database (complete_task, SECURITY DEFINER), running as
// the signed-in user: it checks ownership, status and the task's period atomically.
export async function POST(_request: Request, ctx: RouteContext<"/api/tasks/[id]/complete">) {
  const { user, response } = await authorize();
  if (!user) return response;

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(400, "משימה לא תקינה");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_task", { p_task_id: id });
  if (error) {
    if (error.code === "P0002") return jsonError(404, "המשימה לא נמצאה");
    if (error.code === "P0001") return jsonError(409, error.message === "task period has ended" ? "הזמן למשימה הזו נגמר" : "המשימה כבר הושלמה");
    console.error("complete_task failed", error);
    return jsonError(500, "משהו השתבש. נסה/י שוב.");
  }
  return NextResponse.json(data as CompleteTaskResult);
}
