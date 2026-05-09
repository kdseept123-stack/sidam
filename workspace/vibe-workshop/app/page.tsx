"use client";

import { useState } from "react";
import {
  CalendarDaysIcon,
  MapPinIcon,
  UsersIcon,
  ComputerDesktopIcon,
  ChevronDownIcon,
} from "@heroicons/react/16/solid";
import { supabase } from "@/lib/supabase";

const DEPARTMENTS = [
  "프로덕트", "마케팅", "세일즈", "컨설팅", "개발", "디자인", "경영지원", "기타",
];
const POSITIONS = ["사원", "대리", "과장", "차장", "부장", "임원"];
const AI_EXPERIENCES = [
  "처음이에요",
  "ChatGPT 정도 써봤어요",
  "Claude도 써봤어요",
  "Claude Code까지 써봤어요",
];
const LEARNING_GOALS = [
  "업무 자동화", "데이터 분석", "웹서비스 만들기", "AI 도구 전반", "기타",
];

type FormData = {
  name: string;
  email: string;
  department: string;
  position: string;
  aiExperience: string;
  learningGoal: string;
  dietary: string;
};

type Errors = Partial<Record<keyof FormData, string>>;

const EMPTY: FormData = {
  name: "",
  email: "",
  department: "",
  position: "",
  aiExperience: "",
  learningGoal: "",
  dietary: "",
};

function SelectField({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  error?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-400 mb-1.5">{label} *</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className={`w-full h-10 px-3 pr-8 bg-white/5 text-sm rounded focus:outline-none focus:bg-white/10 transition-colors appearance-none cursor-pointer ${
            value ? "text-white" : "text-neutral-500"
          }`}
        >
          <option value="" disabled>
            선택해주세요
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-neutral-900 text-white">
              {opt}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
      </div>
      {error && <p className="text-xs text-orange-500 mt-1">{error}</p>}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const update =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "이름을 입력해주세요";
    if (!form.email.trim()) {
      e.email = "이메일을 입력해주세요";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = "올바른 이메일 형식이 아닙니다";
    }
    if (!form.department) e.department = "선택해주세요";
    if (!form.position) e.position = "선택해주세요";
    if (!form.aiExperience) e.aiExperience = "선택해주세요";
    if (!form.learningGoal) e.learningGoal = "선택해주세요";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSubmitError("");

    const { error } = await supabase.from("signups").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department,
      position: form.position,
      ai_experience: form.aiExperience,
      learning_goal: form.learningGoal,
      dietary_restrictions: form.dietary.trim() || null,
    });

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        setErrors((prev) => ({ ...prev, email: "이미 신청된 이메일입니다" }));
      } else {
        setSubmitError("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
      return;
    }

    setSubmitted(true);
  };

  const inputCls =
    "w-full h-10 px-3 bg-white/5 text-sm text-white placeholder:text-neutral-500 rounded focus:outline-none focus:bg-white/10 transition-colors";

  if (submitted) {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-2xl font-semibold text-white">
            신청이 완료되었습니다! 🎉
          </p>
          <p className="text-neutral-400 mt-3">당일 노트북 꼭 챙겨오세요.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-2xl mx-auto px-6">

        {/* 헤드라인 */}
        <section className="py-16">
          <h1 className="text-2xl md:text-4xl font-semibold">
            AI 바이브 코딩 마스터클래스
          </h1>
          <p className="text-lg text-neutral-400 mt-3">
            코딩 없이 AI로 업무 도구를 만드는 법
          </p>
        </section>

        <div className="border-t border-white/10" />

        {/* 강의 소개 */}
        <section className="py-16">
          <p className="text-base text-neutral-300 leading-relaxed max-w-lg">
            AI에게 말로 지시하면 앱이 만들어집니다.
            <br />
            코딩 경험이 전혀 없어도 괜찮아요.
            <br />
            4시간이면 여러분만의 업무 도구를 직접 만들 수 있습니다.
          </p>
        </section>

        <div className="border-t border-white/10" />

        {/* 행사 정보 2×2 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="py-8 border-b border-white/10 md:pr-8 md:border-r">
            <div className="flex items-start gap-3">
              <CalendarDaysIcon className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">일시</p>
                <p className="text-sm mt-1">2026년 4월 2일 오후 1시~5시</p>
              </div>
            </div>
          </div>
          <div className="py-8 border-b border-white/10 md:pl-8">
            <div className="flex items-start gap-3">
              <MapPinIcon className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">장소</p>
                <p className="text-sm mt-1">본사 대회의실</p>
              </div>
            </div>
          </div>
          <div className="py-8 border-b border-white/10 md:border-b-0 md:pr-8 md:border-r">
            <div className="flex items-start gap-3">
              <UsersIcon className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">대상</p>
                <p className="text-sm mt-1">전 직원 (개발/비개발 무관)</p>
              </div>
            </div>
          </div>
          <div className="py-8 md:pl-8">
            <div className="flex items-start gap-3">
              <ComputerDesktopIcon className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">준비물</p>
                <p className="text-sm mt-1">개인 노트북</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10" />

        {/* 신청 폼 */}
        <section className="py-16">
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-5">
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  이름 *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={update("name")}
                  placeholder="홍길동"
                  className={inputCls}
                />
                {errors.name && (
                  <p className="text-xs text-orange-500 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  이메일 *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  placeholder="hong@company.com"
                  className={inputCls}
                />
                {errors.email && (
                  <p className="text-xs text-orange-500 mt-1">{errors.email}</p>
                )}
              </div>

              <SelectField
                label="소속 팀/부서"
                value={form.department}
                onChange={update("department")}
                options={DEPARTMENTS}
                error={errors.department}
              />
              <SelectField
                label="직급"
                value={form.position}
                onChange={update("position")}
                options={POSITIONS}
                error={errors.position}
              />
              <SelectField
                label="AI 도구 사용 경험"
                value={form.aiExperience}
                onChange={update("aiExperience")}
                options={AI_EXPERIENCES}
                error={errors.aiExperience}
              />
              <SelectField
                label="강의에서 가장 배우고 싶은 것"
                value={form.learningGoal}
                onChange={update("learningGoal")}
                options={LEARNING_GOALS}
                error={errors.learningGoal}
              />

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  식이 제한이나 알레르기
                </label>
                <input
                  type="text"
                  value={form.dietary}
                  onChange={update("dietary")}
                  placeholder="간식 준비 참고용"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-orange-500 text-white text-sm font-medium rounded-full hover:bg-orange-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "신청 중..." : "신청하기"}
              </button>
              {submitError && (
                <p className="text-xs text-orange-500 mt-3 text-center">
                  {submitError}
                </p>
              )}
            </div>
          </form>
        </section>

        <div className="border-t border-white/10" />

        <footer className="py-8">
          <p className="text-xs text-neutral-500">Powered by Listeningmind ☕</p>
        </footer>

      </div>
    </main>
  );
}
