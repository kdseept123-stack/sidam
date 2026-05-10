"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  CalendarDaysIcon,
  MapPinIcon,
  UsersIcon,
  ComputerDesktopIcon,
  ChevronDownIcon,
} from "@heroicons/react/16/solid";

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
  required = true,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">
        {label} {required && <span className="text-[#ff6b35]">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className={`w-full h-11 px-3 pr-9 bg-white/5 border border-white/10 text-sm rounded-lg focus:outline-none focus:border-[#ff6b35]/60 focus:bg-white/8 transition-colors appearance-none cursor-pointer ${
            value ? "text-white" : "text-slate-500"
          }`}
        >
          <option value="" disabled>선택해주세요</option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-[#0d1b35] text-white">
              {opt}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      </div>
      {error && <p className="text-xs text-[#ff6b35] mt-1.5">{error}</p>}
    </div>
  );
}

const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-lg bg-[#ff6b35]/10 flex items-center justify-center shrink-0 mt-0.5">
      <Icon className="w-4 h-4 text-[#ff6b35]" />
    </div>
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm text-white mt-0.5 font-medium">{value}</p>
    </div>
  </div>
);

export default function Home() {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittedEmails = useRef<Set<string>>(new Set());

  const update =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "이름을 입력해주세요";
    if (!form.email.trim()) {
      e.email = "이메일을 입력해주세요";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = "올바른 이메일 형식이 아닙니다";
    } else if (submittedEmails.current.has(form.email.trim().toLowerCase())) {
      e.email = "이미 신청된 이메일입니다";
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

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department,
      position: form.position,
      ai_experience: form.aiExperience,
      learning_goal: form.learningGoal,
      dietary_restrictions: form.dietary.trim() || null,
    };

    if (!supabase) {
      setSubmitError("서버 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    setLoading(true);
    setSubmitError("");

    const { error } = await supabase.from("signups").insert(payload);

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        setErrors((prev) => ({ ...prev, email: "이미 신청된 이메일입니다" }));
      } else {
        setSubmitError("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
      return;
    }

    submittedEmails.current.add(payload.email.toLowerCase());
    setSubmitted(true);
  };

  const inputCls =
    "w-full h-11 px-3 bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 rounded-lg focus:outline-none focus:border-[#ff6b35]/60 focus:bg-white/8 transition-colors";

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#0b1628] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-[#ff6b35]/15 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🎉</span>
          </div>
          <p className="text-2xl font-bold text-white">신청이 완료되었습니다!</p>
          <p className="text-slate-400 mt-3 leading-relaxed">
            당일 노트북 꼭 챙겨오세요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1628] text-white">
      <div className="max-w-2xl mx-auto px-5 sm:px-8">

        {/* 헤드라인 */}
        <section className="pt-16 pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ff6b35]/10 border border-[#ff6b35]/20 text-[#ff6b35] text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b35] animate-pulse" />
            사내 강의 신청 · 2026년 4월 2일
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            AI 바이브 코딩<br />마스터클래스
          </h1>
          <p className="text-slate-400 mt-3 text-base">
            코딩 없이 AI로 업무 도구를 만드는 법
          </p>
        </section>

        {/* 강의 소개 */}
        <section className="pb-12">
          <p className="text-slate-300 leading-relaxed text-[15px]">
            AI에게 말로 지시하면 앱이 만들어집니다.<br />
            코딩 경험이 전혀 없어도 괜찮아요.<br />
            4시간이면 여러분만의 업무 도구를 직접 만들 수 있습니다.
          </p>
        </section>

        {/* 행사 정보 */}
        <section className="pb-12">
          <div className="rounded-2xl border border-white/8 bg-white/3 p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <InfoItem icon={CalendarDaysIcon} label="일시" value="2026년 4월 2일 오후 1시~5시 (4시간)" />
            <InfoItem icon={MapPinIcon} label="장소" value="본사 대회의실" />
            <InfoItem icon={UsersIcon} label="대상" value="전 직원 (개발/비개발 무관)" />
            <InfoItem icon={ComputerDesktopIcon} label="준비물" value="개인 노트북" />
          </div>
        </section>

        {/* 신청 폼 */}
        <section className="pb-16">
          <div className="rounded-2xl border border-white/10 bg-white/4 shadow-2xl shadow-black/40 p-6 sm:p-8">
            <h2 className="text-lg font-semibold mb-6">강의 신청하기</h2>
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    이름 <span className="text-[#ff6b35]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={update("name")}
                    placeholder="홍길동"
                    className={inputCls}
                  />
                  {errors.name && (
                    <p className="text-xs text-[#ff6b35] mt-1.5">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    이메일 <span className="text-[#ff6b35]">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    placeholder="hong@company.com"
                    className={inputCls}
                  />
                  {errors.email && (
                    <p className="text-xs text-[#ff6b35] mt-1.5">{errors.email}</p>
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
                  <label className="block text-xs text-slate-400 mb-1.5">
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

              <button
                type="submit"
                disabled={loading}
                className="mt-8 w-full h-12 bg-[#ff6b35] text-white text-sm font-semibold rounded-xl hover:bg-[#ff7d4d] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "신청 중..." : "신청하기"}
              </button>
              {submitError && (
                <p className="text-xs text-[#ff6b35] mt-3 text-center">{submitError}</p>
              )}
            </form>
          </div>
        </section>

        <footer className="border-t border-white/8 py-8">
          <p className="text-xs text-slate-600">Powered by Listeningmind ☕</p>
        </footer>

      </div>
    </main>
  );
}
