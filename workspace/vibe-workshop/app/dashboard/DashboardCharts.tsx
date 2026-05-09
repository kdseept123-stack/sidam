"use client";

import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut, Bar, Pie, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

const COLORS = [
  "#f97316",
  "#fb923c",
  "#fdba74",
  "#fde68a",
  "#d97706",
  "#b45309",
  "#a3a3a3",
  "#737373",
];

const GRID = "rgba(255,255,255,0.08)";
const TICK = "#737373";
const LEGEND_LABEL = { color: "#a3a3a3", font: { size: 11 }, boxWidth: 10 };

type Props = {
  deptLabels: string[];
  deptData: number[];
  aiLabels: string[];
  aiData: number[];
  goalLabels: string[];
  goalData: number[];
  dailyLabels: string[];
  dailyData: number[];
};

function EmptyState() {
  return (
    <p className="text-xs text-neutral-600 text-center py-12">데이터 없음</p>
  );
}

export default function DashboardCharts({
  deptLabels,
  deptData,
  aiLabels,
  aiData,
  goalLabels,
  goalData,
  dailyLabels,
  dailyData,
}: Props) {
  const hasData = (arr: number[]) => arr.some((v) => v > 0);

  const doughnutData = {
    labels: deptLabels,
    datasets: [
      {
        data: deptData,
        backgroundColor: COLORS,
        borderColor: "#0a0a0a",
        borderWidth: 2,
      },
    ],
  };

  const barData = {
    labels: aiLabels,
    datasets: [
      {
        data: aiData,
        backgroundColor: "#f97316",
        borderRadius: 4,
      },
    ],
  };

  const pieData = {
    labels: goalLabels,
    datasets: [
      {
        data: goalData,
        backgroundColor: COLORS,
        borderColor: "#0a0a0a",
        borderWidth: 2,
      },
    ],
  };

  const lineData = {
    labels: dailyLabels,
    datasets: [
      {
        label: "신청 수",
        data: dailyData,
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.12)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#f97316",
        pointRadius: 4,
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      {/* 소속 팀별 도넛 */}
      <div>
        <p className="text-xs text-neutral-500 mb-6">소속 팀별 신청 분포</p>
        {hasData(deptData) ? (
          <div className="max-w-[280px] mx-auto">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                plugins: { legend: { labels: LEGEND_LABEL } },
              }}
            />
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* AI 경험 수평 바 */}
      <div>
        <p className="text-xs text-neutral-500 mb-6">AI 도구 사용 경험 분포</p>
        {hasData(aiData) ? (
          <Bar
            data={barData}
            options={{
              responsive: true,
              indexAxis: "y" as const,
              plugins: { legend: { display: false } },
              scales: {
                x: {
                  ticks: { color: TICK, stepSize: 1 },
                  grid: { color: GRID },
                },
                y: {
                  ticks: { color: "#a3a3a3", font: { size: 11 } },
                  grid: { display: false },
                },
              },
            }}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* 배우고 싶은 것 파이 */}
      <div>
        <p className="text-xs text-neutral-500 mb-6">가장 배우고 싶은 것 분포</p>
        {hasData(goalData) ? (
          <div className="max-w-[280px] mx-auto">
            <Pie
              data={pieData}
              options={{
                responsive: true,
                plugins: { legend: { labels: LEGEND_LABEL } },
              }}
            />
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* 일별 신청 추이 라인 */}
      <div>
        <p className="text-xs text-neutral-500 mb-6">일별 신청 추이 (최근 7일)</p>
        <Line
          data={lineData}
          options={{
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: TICK }, grid: { color: GRID } },
              y: {
                ticks: { color: TICK, stepSize: 1 },
                grid: { color: GRID },
                min: 0,
              },
            },
          }}
        />
      </div>
    </div>
  );
}
