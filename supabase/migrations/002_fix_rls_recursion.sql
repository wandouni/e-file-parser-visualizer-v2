-- ================================================================
-- 002_fix_rls_recursion.sql
-- 修复 case_members RLS 策略无限递归问题
--
-- 根因：case_members_select 策略查询 case_members 本身 → 死循环
-- 解决：用 SECURITY DEFINER 函数绕过 RLS 做成员角色查询
-- ================================================================

-- Step 1: 创建辅助函数（SECURITY DEFINER = 以超级用户身份执行，绕过 RLS）
CREATE OR REPLACE FUNCTION public.get_user_case_role(p_case_id uuid, p_user_id uuid)
RETURNS text AS $$
  SELECT role::text FROM public.case_members
  WHERE case_id = p_case_id AND user_id = p_user_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: 删除并重建 case_members 策略（原策略自引用 → 递归根源）
DROP POLICY IF EXISTS "case_members_select" ON public.case_members;
DROP POLICY IF EXISTS "case_members_insert_owner" ON public.case_members;
DROP POLICY IF EXISTS "case_members_update_owner" ON public.case_members;
DROP POLICY IF EXISTS "case_members_delete_owner" ON public.case_members;

CREATE POLICY "case_members_select" ON public.case_members FOR SELECT
  USING (public.get_user_case_role(case_id, auth.uid()) IS NOT NULL);

CREATE POLICY "case_members_insert_owner" ON public.case_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.get_user_case_role(case_id, auth.uid()) = 'owner'
  );

CREATE POLICY "case_members_update_owner" ON public.case_members FOR UPDATE
  USING (public.get_user_case_role(case_id, auth.uid()) = 'owner');

CREATE POLICY "case_members_delete_owner" ON public.case_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.get_user_case_role(case_id, auth.uid()) = 'owner'
  );

-- Step 3: 删除并重建 cases 策略（引用 case_members → 触发上面的递归）
DROP POLICY IF EXISTS "cases_select" ON public.cases;
DROP POLICY IF EXISTS "cases_insert" ON public.cases;
DROP POLICY IF EXISTS "cases_update_owner" ON public.cases;
DROP POLICY IF EXISTS "cases_delete_owner" ON public.cases;

CREATE POLICY "cases_select" ON public.cases FOR SELECT
  USING (public.get_user_case_role(id, auth.uid()) IS NOT NULL);

-- INSERT 策略：允许已登录用户以自己为 owner 创建案例
CREATE POLICY "cases_insert" ON public.cases FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "cases_update_owner" ON public.cases FOR UPDATE
  USING (public.get_user_case_role(id, auth.uid()) = 'owner');

CREATE POLICY "cases_delete_owner" ON public.cases FOR DELETE
  USING (public.get_user_case_role(id, auth.uid()) = 'owner');

-- Step 4: 删除并重建 case_invites 策略
DROP POLICY IF EXISTS "case_invites_select" ON public.case_invites;
DROP POLICY IF EXISTS "case_invites_insert_owner" ON public.case_invites;

CREATE POLICY "case_invites_select" ON public.case_invites FOR SELECT
  USING (public.get_user_case_role(case_id, auth.uid()) IS NOT NULL);

CREATE POLICY "case_invites_insert_owner" ON public.case_invites FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_user_case_role(case_id, auth.uid()) = 'owner'
  );

-- Step 5: 删除并重建 histories 策略
DROP POLICY IF EXISTS "histories_select" ON public.histories;
DROP POLICY IF EXISTS "histories_insert_editor" ON public.histories;
DROP POLICY IF EXISTS "histories_update_editor" ON public.histories;
DROP POLICY IF EXISTS "histories_delete" ON public.histories;

CREATE POLICY "histories_select" ON public.histories FOR SELECT
  USING (public.get_user_case_role(case_id, auth.uid()) IS NOT NULL);

CREATE POLICY "histories_insert_editor" ON public.histories FOR INSERT
  WITH CHECK (
    imported_by = auth.uid()
    AND public.get_user_case_role(case_id, auth.uid()) IN ('owner', 'editor')
  );

CREATE POLICY "histories_update_editor" ON public.histories FOR UPDATE
  USING (public.get_user_case_role(case_id, auth.uid()) IN ('owner', 'editor'));

CREATE POLICY "histories_delete" ON public.histories FOR DELETE
  USING (
    imported_by = auth.uid()
    OR public.get_user_case_role(case_id, auth.uid()) = 'owner'
  );
