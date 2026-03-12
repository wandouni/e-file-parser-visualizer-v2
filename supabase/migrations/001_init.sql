-- ================================================================
-- 001_init.sql
-- 初始化数据库结构
-- ================================================================

-- 用户角色枚举
CREATE TYPE case_role AS ENUM ('owner', 'editor', 'viewer');

-- ── profiles 表（扩展 auth.users）──────────────────────────────
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  wechat_openid TEXT UNIQUE,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── cases 表 ────────────────────────────────────────────────────
CREATE TABLE public.cases (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── case_members 表 ──────────────────────────────────────────────
CREATE TABLE public.case_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id   UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      case_role NOT NULL DEFAULT 'viewer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(case_id, user_id)
);

-- ── case_invites 表 ──────────────────────────────────────────────
CREATE TABLE public.case_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  role       case_role NOT NULL DEFAULT 'viewer',
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses   INT,
  use_count  INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── histories 表 ─────────────────────────────────────────────────
CREATE TABLE public.histories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  import_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by UUID NOT NULL REFERENCES public.profiles(id),
  section_tag TEXT NOT NULL,
  meta        JSONB NOT NULL DEFAULT '{}',
  fields      TEXT[] NOT NULL DEFAULT '{}',
  labels      TEXT[] NOT NULL DEFAULT '{}',
  rows        JSONB NOT NULL DEFAULT '[]',
  col_config  JSONB NOT NULL DEFAULT '{}',
  page_size   INT NOT NULL DEFAULT 20,
  viz_configs JSONB NOT NULL DEFAULT '[]',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 索引 ─────────────────────────────────────────────────────────
CREATE INDEX idx_case_members_user_id ON public.case_members(user_id);
CREATE INDEX idx_case_members_case_id ON public.case_members(case_id);
CREATE INDEX idx_histories_case_id ON public.histories(case_id);
CREATE INDEX idx_histories_sort_order ON public.histories(case_id, sort_order);
CREATE INDEX idx_cases_owner_id ON public.cases(owner_id);
CREATE INDEX idx_case_invites_token ON public.case_invites(token);

-- ── 触发器：自动创建 profile ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
    NEW.raw_user_meta_data->>'display_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── 触发器：updated_at 自动更新 ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

CREATE TRIGGER set_histories_updated_at
  BEFORE UPDATE ON public.histories
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.histories ENABLE ROW LEVEL SECURITY;

-- profiles 策略
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- case_members 策略（允许查看自己参与案例的成员列表）
CREATE POLICY "case_members_select" ON public.case_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_members cm
      WHERE cm.case_id = case_members.case_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "case_members_insert_owner" ON public.case_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.case_members cm
      WHERE cm.case_id = case_members.case_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
    OR user_id = auth.uid()  -- 允许用户将自己加入（邀请接受场景）
  );

CREATE POLICY "case_members_update_owner" ON public.case_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.case_members cm
      WHERE cm.case_id = case_members.case_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
  );

CREATE POLICY "case_members_delete_owner" ON public.case_members FOR DELETE
  USING (
    user_id = auth.uid()  -- 用户可以退出案例
    OR EXISTS (
      SELECT 1 FROM public.case_members cm
      WHERE cm.case_id = case_members.case_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
  );

-- cases 策略
CREATE POLICY "cases_select" ON public.cases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_members
      WHERE case_id = cases.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "cases_insert" ON public.cases FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "cases_update_owner" ON public.cases FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "cases_delete_owner" ON public.cases FOR DELETE
  USING (owner_id = auth.uid());

-- case_invites 策略
CREATE POLICY "case_invites_select" ON public.case_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_members
      WHERE case_id = case_invites.case_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "case_invites_insert_owner" ON public.case_invites FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.case_members
      WHERE case_id = case_invites.case_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

CREATE POLICY "case_invites_delete_owner" ON public.case_invites FOR DELETE
  USING (created_by = auth.uid());

-- histories 策略
CREATE POLICY "histories_select" ON public.histories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_members
      WHERE case_id = histories.case_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "histories_insert_editor" ON public.histories FOR INSERT
  WITH CHECK (
    imported_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.case_members
      WHERE case_id = histories.case_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "histories_update_editor" ON public.histories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.case_members
      WHERE case_id = histories.case_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "histories_delete" ON public.histories FOR DELETE
  USING (
    imported_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.case_members
      WHERE case_id = histories.case_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- ── 开启 Realtime ─────────────────────────────────────────────────
-- 在 Supabase Dashboard → Database → Replication 中手动开启
-- histories 和 case_members 表的 Realtime 功能
