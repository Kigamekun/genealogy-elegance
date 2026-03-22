import type { FamilyMember } from "@/lib/family-data";
import { differenceInYears, format, isValid, parseISO } from "date-fns";
import { id as indonesianLocale } from "date-fns/locale";

function startOfLocalToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function parseFamilyDate(value?: string): Date | null {
  if (!value) return null;

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function formatFamilyDate(value?: string, style: "short" | "long" = "short"): string {
  const parsed = parseFamilyDate(value);
  if (!parsed) return "-";

  return format(parsed, style === "long" ? "d MMMM yyyy" : "d MMM yyyy", {
    locale: indonesianLocale,
  });
}

export function isMemberDeceased(member: Pick<FamilyMember, "deathDate">): boolean {
  return Boolean(parseFamilyDate(member.deathDate));
}

export function getMemberAge(member: Pick<FamilyMember, "birthDate" | "deathDate">): number | null {
  const birthDate = parseFamilyDate(member.birthDate);
  if (!birthDate) return null;

  const endDate = parseFamilyDate(member.deathDate) ?? startOfLocalToday();
  if (endDate.getTime() < birthDate.getTime()) return 0;

  return differenceInYears(endDate, birthDate);
}
