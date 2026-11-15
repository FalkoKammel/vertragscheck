'use client';

import { BudgetPanel } from './BudgetPanel';
import { ModelTable } from './ModelTable';
import { StatsTiles } from './StatsTiles';
import { useStats } from './useStats';

export function TransparencyView() {
  const { data, isError } = useStats();
  const stats = isError ? null : data;

  return (
    <>
      <StatsTiles stats={stats} />
      <BudgetPanel stats={stats} />
      <ModelTable activeModelId={stats?.activeModelId} />
    </>
  );
}
