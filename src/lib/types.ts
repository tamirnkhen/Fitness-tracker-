import type { Domain, TaskKind } from "@/lib/game/domains";

export interface Profile {
  id: string;
  display_name: string | null;
  role: "user" | "admin";
  birth_date: string | null;
  age_verified_at: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  photo_consent_at: string | null;
  onboarding_completed_at: string | null;
  xp_total: number;
  level: number;
  timezone: string;
  last_active_at: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  domain: Domain;
  custom_label: string | null;
  title: string;
  baseline: string | null;
  target: string | null;
  status: "active" | "archived";
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  template_id: string | null;
  goal_id: string | null;
  domain: Domain;
  custom_label: string | null;
  kind: TaskKind;
  title: string;
  description: string | null;
  xp: number;
  target_count: number;
  progress: number;
  status: "open" | "done" | "expired";
  period_key: string;
  completed_at: string | null;
  created_at: string;
}

export interface Character {
  user_id: string;
  source_path: string | null;
  avatar_path: string | null;
  status: "none" | "uploaded" | "generating" | "ready" | "failed";
  equipped: string[];
  generation_count: number;
  updated_at: string;
}

export interface CompleteTaskResult {
  task_id: string;
  completed: boolean;
  progress: number;
  target_count: number;
  xp_awarded: number;
  xp_total: number;
  level_before: number;
  level_after: number;
}
