-- ============================================================
-- Departments & Tasks Module
-- ============================================================

-- 1. DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',   -- hex color for UI badges
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_departments_org ON departments(org_id);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON departments
  FOR ALL USING (org_id = public.user_org_id());

-- 2. USER ↔ DEPARTMENT (many-to-many)
-- ============================================================
CREATE TABLE user_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_lead BOOLEAN NOT NULL DEFAULT false,   -- department lead can manage dept tasks
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

CREATE INDEX idx_user_departments_user ON user_departments(user_id);
CREATE INDEX idx_user_departments_dept ON user_departments(department_id);

ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON user_departments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = user_departments.user_id AND u.org_id = public.user_org_id()
    )
  );

-- 3. TASKS
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,

  -- Status workflow: open → in_progress → review → done (+ cancelled)
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'review', 'done', 'cancelled')),

  -- Priority
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Assignment: can assign to a user, a department, or both
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,

  -- Categorization
  task_type TEXT NOT NULL DEFAULT 'general'
    CHECK (task_type IN ('general', 'production', 'maintenance', 'safety', 'quality', 'admin')),

  -- Optional links to production entities
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,

  -- Dates
  due_date DATE,
  completed_at TIMESTAMPTZ,

  -- Who created it
  created_by UUID NOT NULL REFERENCES users(id),

  -- Recurrence (null = one-time)
  -- Future: 'daily', 'weekly', 'monthly' etc.
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_org ON tasks(org_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_department ON tasks(department_id);
CREATE INDEX idx_tasks_status ON tasks(org_id, status);
CREATE INDEX idx_tasks_due ON tasks(org_id, due_date) WHERE due_date IS NOT NULL AND status NOT IN ('done', 'cancelled');

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON tasks
  FOR ALL USING (org_id = public.user_org_id());

-- 4. TASK COMMENTS / ACTIVITY LOG
-- ============================================================
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  -- 'comment' = user note, 'status_change' = auto-logged status transition
  comment_type TEXT NOT NULL DEFAULT 'comment'
    CHECK (comment_type IN ('comment', 'status_change', 'assignment', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON task_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = task_comments.task_id AND t.org_id = public.user_org_id()
    )
  );

-- 5. TASK NOTIFICATIONS
-- ============================================================
CREATE TABLE task_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('assigned', 'status_changed', 'comment', 'due_soon', 'overdue')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_notifications_user ON task_notifications(user_id, is_read);
CREATE INDEX idx_task_notifications_task ON task_notifications(task_id);

ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON task_notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = task_notifications.task_id AND t.org_id = public.user_org_id()
    )
  );

-- 6. MODULE REGISTRATION
-- ============================================================
INSERT INTO modules (slug, name, description, category, icon, is_free, is_core, sort_order) VALUES
  ('tasks', 'Tasks & Departments', 'Assign tasks to users and departments with due dates and notifications', 'operations', 'ClipboardCheck', true, true, 55);

-- 7. PERMISSIONS
-- ============================================================
INSERT INTO permissions (code, category, name, description, module_slug) VALUES
  ('tasks.view',       'Tasks', 'View Tasks',       'View tasks assigned to you, your department, or all tasks',      'tasks'),
  ('tasks.create',     'Tasks', 'Create Tasks',     'Create new tasks and assign them',                               'tasks'),
  ('tasks.edit',       'Tasks', 'Edit Tasks',       'Edit task details, status, and assignments',                     'tasks'),
  ('tasks.delete',     'Tasks', 'Delete Tasks',     'Delete tasks',                                                   'tasks'),
  ('departments.view', 'Departments', 'View Departments', 'View departments and their members',                       'tasks'),
  ('departments.manage','Departments', 'Manage Departments', 'Create, edit, and manage department membership',         'tasks');
