import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import type { Row, VizConfig, MultiSubjectConfig } from '@/types'

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name'),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  isBanned: integer('is_banned', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const cases = sqliteTable('cases', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const caseMembers = sqliteTable('case_members', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('viewer'), // owner | editor | viewer
  joinedAt: text('joined_at').notNull().default(sql`(datetime('now'))`),
})

export const histories = sqliteTable('histories', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  importedBy: text('imported_by').notNull(),
  importTime: text('import_time').notNull().default(sql`(datetime('now'))`),
  sectionTag: text('section_tag').notNull(),
  meta: text('meta', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
  fields: text('fields', { mode: 'json' }).$type<string[]>().notNull().default([]),
  labels: text('labels', { mode: 'json' }).$type<string[]>().notNull().default([]),
  rows: text('rows', { mode: 'json' }).$type<Row[]>().notNull().default([]),
  colConfig: text('col_config', { mode: 'json' }).$type<Record<string, boolean>>().notNull().default({}),
  pageSize: integer('page_size').notNull().default(22),
  vizConfigs: text('viz_configs', { mode: 'json' }).$type<VizConfig[]>().notNull().default([]),
  multiSubjectConfig: text('multi_subject_config', { mode: 'json' }).$type<MultiSubjectConfig | null>(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const caseInvites = sqliteTable('case_invites', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').notNull(),
  role: text('role').notNull().default('viewer'),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})
