import { supabase } from "@/lib/supabase";
import DashboardCharts from "./DashboardCharts";

export const dynamic = "force-dynamic";

const DEPARTMENTS = [
  "프로덕트", "마케팅", "세일즈", "컨설팅", "개발", "디자인", "경영지원", "기타",
];
const AI_EXPERIENCES = [
  "처음이에요",
  "ChatGPT 정도 써봤어요",
  "Claude도 써봤어요",
  "Claude Code까지 써봤어요",
];
const LEARNING_GOALS = [
  "업무 자동화", "데이터 분석", "웹서비스 만들기", "AI 도구 전반", "기타",
];

type Signup = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  department: string;
  position: string;
  ai_experience: string;
  learning_goal: string;
  dietary_restrictions: string | null;
};

const toSeoulDateStr = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const normalize = (value: string, list: string[]): string =>
  list.includes(value) ? value : "기타";

const freq = (rows: Signup[], key: keyof Signup, list: string[]) => {
  const map: Record<string, number> = {};
  rows.forEach((r) => {
    const v = normalize(r[key] as string, list);
    map[v] = (map[v] ?? 0) + 1;
  });
  return map;
};

const topKey = (map: Record<string, number>): string =>
  Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export default async function DashboardPage() {
  const { data } = supabase
    ? await supabase.from("signups").select("*").order("created_at", { ascending: false })
    : { data: [] };

  const rows: Signup[] = data ?? [];
  const total = rows.length;

  const todayStr = toSeoulDateStr(new Date());
  const todayCount = rows.filter(
    (r) => toSeoulDateStr(new Date(r.created_at)) === todayStr
  ).length;

  const deptFreq = freq(rows, "department", DEPARTMENTS);
  const aiFreq = freq(rows, "ai_experience", AI_EXPERIENCES);
  const goalFreq = freq(rows, "learning_goal", LEARNING_GOALS);

  const topDept = total > 0 ? topKey(deptFreq) : "-";
  const topAI = total > 0 ? topKey(aiFreq) : "-";

  const deptData = DEPARTMENTS.map((d) => deptFreq[d] ?? 0);
  const aiData = AI_EXPERIENCES.map((a) => aiFreq[a] ?? 0);
  const goalData = LEARNING_GOALS.map((g) => goalFreq[g] ?? 0);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { label: toSeoulDateStr(d).slice(5), str: toSeoulDateStr(d) };
  });
  const dailyLabels = last7.map((d) => d.label);
  const dailyData = last7.map(
    ({ str }) =>
      rows.filter((r) => toSeoulDateStr(new Date(r.created_at)) === str).length
  );

  const summaryCards = [
    { label: "총 신청 인원", value: String(total), unit: "명" },
    { label: "오늘 신청 인원", value: String(todayCount), unit: "명" },
    { label: "가장 많은 소속 팀", value: topDept, unit: "" },
    { label: "가장 많은 AI 경험", value: topAI, unit: "" },
  ];

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">

        <h1 className="text-2xl font-bold mb-1">신청 현황</h1>
        <p className="text-sm text-neutral-400 mb-12">
          AI 바이브 코딩 마스터클래스
        </p>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {summaryCards.map((card, i) => (
            <div
              key={i}
              className="bg-[#1a1a2e] rounded-2xl px-5 py-5 shadow-lg shadow-black/30 border border-white/5"
            >
              <p className="text-xs text-neutral-500 mb-3">{card.label}</p>
              <p className="text-2xl font-bold leading-tight truncate">
                {card.value}
                {card.unit && (
                  <span className="text-sm text-neutral-400 font-normal ml-1">
                    {card.unit}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* 차트 */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/5 shadow-lg shadow-black/30 p-6 sm:p-8 mb-12">
          <DashboardCharts
            deptLabels={DEPARTMENTS}
            deptData={deptData}
            aiLabels={AI_EXPERIENCES}
            aiData={aiData}
            goalLabels={LEARNING_GOALS}
            goalData={goalData}
            dailyLabels={dailyLabels}
            dailyData={dailyData}
          />
        </div>

        {/* 신청자 목록 */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/5 shadow-lg shadow-black/30 p-6 sm:p-8">
          <p className="text-sm font-semibold mb-6">
            신청자 목록{" "}
            <span className="text-[#ff6b35] ml-1">{total}명</span>
          </p>

          {total === 0 ? (
            <p className="text-sm text-neutral-600 text-center py-16">
              아직 신청자가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    {[
                      "이름", "이메일", "소속 팀", "직급",
                      "AI 경험", "배우고 싶은 것", "식이 제한", "신청일시",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs text-neutral-500 font-normal pb-3 pr-6 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3 pr-6 whitespace-nowrap font-medium">{row.name}</td>
                      <td className="py-3 pr-6 text-neutral-400 text-xs">{row.email}</td>
                      <td className="py-3 pr-6 whitespace-nowrap text-neutral-300">{row.department}</td>
                      <td className="py-3 pr-6 whitespace-nowrap text-neutral-300">{row.position}</td>
                      <td className="py-3 pr-6 whitespace-nowrap text-neutral-300">{row.ai_experience}</td>
                      <td className="py-3 pr-6 whitespace-nowrap text-neutral-300">{row.learning_goal}</td>
                      <td className="py-3 pr-6 whitespace-nowrap">
                        {row.dietary_restrictions ? (
                          <span className="inline-block bg-yellow-400/20 text-yellow-200 text-xs px-2 py-0.5 rounded">
                            {row.dietary_restrictions}
                          </span>
                        ) : (
                          <span className="text-neutral-700">—</span>
                        )}
                      </td>
                      <td className="py-3 whitespace-nowrap text-neutral-500 text-xs">
                        {formatDateTime(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
