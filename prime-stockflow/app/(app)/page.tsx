import Link from "next/link";
import { Card, EmptyState, SectionTitle } from "@/components/ui/Card";
import { getDashboardStatsAction, getActivityAction } from "@/lib/actions/dashboard";
import { todayLabel, timeAgo } from "@/lib/dates";

export default async function HomePage() {
  const [statsResult, activityResult] = await Promise.all([
    getDashboardStatsAction(),
    getActivityAction({ limit: 8 }),
  ]);

  const stats = statsResult.success
    ? statsResult.data
    : { totalSkus: 0, openOrders: 0, totalReserved: 0, readyOrders: 0 };

  const activity = activityResult.success ? activityResult.data.items : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Warehouse</h1>
        <span className="text-[13px] text-text2">{todayLabel()}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <Card className="mb-0">
          <div className="text-xs text-text2 mb-1">Total SKUs</div>
          <div className="text-[28px] font-bold">{stats.totalSkus}</div>
        </Card>
        <Card className="mb-0">
          <div className="text-xs text-text2 mb-1">Open orders</div>
          <div className="text-[28px] font-bold text-accent">{stats.openOrders}</div>
        </Card>
        <Card className="mb-0">
          <div className="text-xs text-text2 mb-1">Reserved</div>
          <div className="text-[28px] font-bold text-warn">{stats.totalReserved}</div>
        </Card>
        <Card className="mb-0">
          <div className="text-xs text-text2 mb-1">Ready to dispatch</div>
          <div className="text-[28px] font-bold text-success">{stats.readyOrders}</div>
        </Card>
      </div>

      <SectionTitle>Quick actions</SectionTitle>
      <div className="flex flex-col gap-2.5">
        <Link
          href="/scan"
          className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-border2 bg-surface px-4 py-3.5 text-sm font-medium"
        >
          Scan barcode to reserve or look up
        </Link>
        <Link
          href="/orders?filter=ready"
          className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-border2 bg-surface px-4 py-3.5 text-sm font-medium"
        >
          View orders ready for dispatch
        </Link>
      </div>

      <SectionTitle>Recent activity</SectionTitle>
      {activity.length === 0 ? (
        <EmptyState message="No activity yet" />
      ) : (
        <Card className="py-1">
          {activity.map((a) => (
            <div
              key={a.id}
              className="flex justify-between items-start py-2.5 border-b border-border last:border-b-0 gap-2.5"
            >
              <span className="text-sm">{a.message}</span>
              <span className="text-xs text-text3 shrink-0">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
