export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { profiles, cases, histories } from '@/lib/db/schema';
import { eq, gte, count } from 'drizzle-orm';
import LiveSpec from '@/components/LiveSpec';
import { spec, pageName } from './live-spec';
import { history } from './live-spec.history';

async function getStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [
    [{ totalUsers }],
    [{ totalCases }],
    [{ totalHistories }],
    [{ recentUsers }],
    [{ recentCases }],
    [{ bannedUsers }],
  ] = await Promise.all([
    db.select({ totalUsers: count() }).from(profiles),
    db.select({ totalCases: count() }).from(cases),
    db.select({ totalHistories: count() }).from(histories),
    db
      .select({ recentUsers: count() })
      .from(profiles)
      .where(gte(profiles.createdAt, sevenDaysAgo)),
    db
      .select({ recentCases: count() })
      .from(cases)
      .where(gte(cases.createdAt, sevenDaysAgo)),
    db
      .select({ bannedUsers: count() })
      .from(profiles)
      .where(eq(profiles.isBanned, true)),
  ]);

  return {
    totalUsers,
    totalCases,
    totalHistories,
    recentUsers,
    recentCases,
    bannedUsers,
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const statCards = [
    {
      label: '注册用户',
      value: stats.totalUsers,
      sub: `+${stats.recentUsers} 近 7 天`,
      color: '#2563eb',
    },
    {
      label: '案例总数',
      value: stats.totalCases,
      sub: `+${stats.recentCases} 近 7 天`,
      color: '#7c3aed',
    },
    {
      label: '数据集总数',
      value: stats.totalHistories,
      sub: '所有案例',
      color: '#059669',
    },
    {
      label: '封禁用户',
      value: stats.bannedUsers,
      sub: '当前封禁',
      color: '#dc2626',
    },
  ];

  return (
    <div>
      <LiveSpec content={spec} pageName={pageName} history={history} />
      <h1
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: 20,
        }}
      >
        系统总览
      </h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {statCards.map(({ label, value, sub, color }) => (
          <div
            key={label}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '18px 20px',
            }}
          >
            <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
              {label}
            </p>
            <p
              style={{
                fontSize: 28,
                fontWeight: 700,
                color,
                marginBottom: 4,
                lineHeight: 1,
              }}
            >
              {value.toLocaleString()}
            </p>
            <p style={{ fontSize: 10, color: '#94a3b8' }}>{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
