import { LineChart } from "./LineChart";
import { BurndownChart } from "./BurndownChart";
import { Donut } from "./Donut";
import { Heatmap } from "./Heatmap";
import { MetricCard } from "./MetricCard";
import { ChartCard } from "./ChartCard";
import { gitSnapshot } from "@/mocks/git";
import { tasksSnapshot } from "@/mocks/tasks";

// Stories render synchronously off the deterministic snapshot facades (the
// async providers are the contract seam; see mocks/*.ts).
const git = gitSnapshot;
const tasks = tasksSnapshot;

export const Line = () => (
  <div className="w-[480px]">
    <ChartCard title="Commits per week">
      <LineChart data={git.getSeries().commits} labels={git.getWeeks()} height={150} />
    </ChartCard>
  </div>
);

export const LineEmpty = () => (
  <div className="w-[480px]">
    <ChartCard title="No data">
      <LineChart data={[]} labels={[]} />
    </ChartCard>
  </div>
);

export const DonutSplit = () => (
  <div className="w-[320px]">
    <ChartCard title="PR Categories">
      <Donut segments={git.getPrCategories()} />
    </ChartCard>
  </div>
);

export const DualBurndown = () => {
  const b = tasks.getBurndown();
  return (
    <div className="flex w-[1000px] gap-4">
      <div className="flex-1">
        <ChartCard title="Sprint burndown">
          <BurndownChart ideal={b.ideal} actual={b.team} />
        </ChartCard>
      </div>
      <div className="flex-1">
        <ChartCard title="My burndown">
          <BurndownChart ideal={b.myIdeal} actual={b.mine} accentVar="--chart-2" />
        </ChartCard>
      </div>
    </div>
  );
};

export const WorkingTimesHeatmap = () => (
  <div className="w-[820px]">
    <ChartCard title="Activity heatmap">
      <Heatmap grid={git.getWorkHeatmap()} coreStart={9} coreEnd={17} />
    </ChartCard>
  </div>
);

export const Metrics = () => (
  <div className="grid w-[820px] grid-cols-3 gap-3">
    {git.getDora().map((m) => (
      <MetricCard key={m.label} metric={m} />
    ))}
  </div>
);
