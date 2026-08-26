"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import type { AgeGroup, Gender, NewcomerRecord, Referrer } from "@/types/api";

/** 라벨은 `/welcome/register` 폼의 선택지와 같은 문구를 쓴다 (같은 데이터다) */
const GENDER_LABEL: Record<Gender, string> = { MALE: "남", FEMALE: "여" };

const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  EARLY_20S: "20대 초반",
  LATE_20S: "20대 후반",
  EARLY_30S: "30대 초반",
  LATE_30S: "30대 후반",
};

const REFERRER_LABEL: Record<Referrer, string> = {
  FRIEND: "지인 소개",
  SEARCH: "검색",
  SNS: "SNS",
  ETC: "기타",
};

/** "8/19" (WIREFRAME.md §20) */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 선택 항목이 비어 있을 수 있다 (`/welcome/register`가 성별·연령대·유입경로를
 * 필수로 받지 않는다). 채워진 것만 `·`로 이어 붙인다 — 빈 값을 "—"로
 * 늘어놓으면 실제로 채워진 정보가 묻힌다.
 */
function metaLine(record: NewcomerRecord): string {
  const parts = [
    record.phone,
    record.gender ? GENDER_LABEL[record.gender] : null,
    record.ageGroup ? AGE_GROUP_LABEL[record.ageGroup] : null,
    record.referrer ? REFERRER_LABEL[record.referrer] : null,
  ].filter((v): v is string => Boolean(v));
  return parts.join(" · ");
}

/**
 * WIREFRAME.md §20 — 새가족 등록 내역 (FR-ADM-07, SPEC_API §8.6).
 * 권한은 `L` 이상이다 (회원 관리와 달리 전도사 전용이 아니다).
 */
export function NewcomerList() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "newcomers"],
    queryFn: () => api.admin.newcomers(),
  });

  if (isLoading) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError) {
    // UI 게이트를 통과했어도 최종 판단은 서버다 (SPEC_API §8.6은 `L` 이상)
    const forbidden = isApiError(error) && error.code === "FORBIDDEN";
    return (
      <Section className="pt-8">
        <p role="alert" className="text-[var(--color-red-500)]">
          {forbidden
            ? "새가족 등록 내역을 볼 권한이 없습니다."
            : isApiError(error)
              ? error.message
              : "목록을 불러오지 못했습니다."}
        </p>
      </Section>
    );
  }

  const items: NewcomerRecord[] = data?.items ?? [];

  return (
    <Section className="pt-8">
      {items.length === 0 ? (
        <p className="text-[var(--color-gray-400)]">등록된 새가족 신청이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-navy-100)] border-y border-[var(--color-navy-100)]">
          {items.map((record) => (
            <li key={record.id} className="py-4">
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm text-[var(--color-gray-400)]">
                  {formatDate(record.createdAt)}
                </span>
                <span className="font-bold">{record.name}</span>
                <span className="text-sm text-[var(--color-gray-400)]">{metaLine(record)}</span>
              </p>
              {record.message && (
                <p className="mt-2 text-sm">&ldquo;{record.message}&rdquo;</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
