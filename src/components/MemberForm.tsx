import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useIsConstrainedMode } from "@/hooks/use-performance-mode";
import {
  FamilyMember,
  MAX_INLINE_AVATAR_BYTES,
  estimateDataUrlBytes,
  getSpouseRelations,
  type SpouseRelationStatus,
} from "@/lib/family-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MemberFormValues {
  name: string;
  gender: FamilyMember["gender"];
  birthDate: string;
  deathDate?: string;
  description: string;
  avatarUrl?: string;
  isStepChild?: boolean;
  spouseStatuses?: Record<string, SpouseRelationStatus>;
}

interface MemberFormProps {
  member?: FamilyMember;
  title?: string;
  submitLabel?: string;
  defaultGender?: FamilyMember["gender"];
  relatedSpouses?: Array<{ id: string; name: string }>;
  stepChildOption?: {
    stepParentName: string;
    biologicalParentName: string;
  };
  onSave: (values: MemberFormValues) => void;
  onCancel: () => void;
}

const MAX_IMAGE_SIZE_BYTES = MAX_INLINE_AVATAR_BYTES;
const MAX_AVATAR_DIMENSION = 768;
const MAX_AVATAR_COMPRESSION_ATTEMPTS = 4;
const INITIAL_AVATAR_QUALITY = 0.82;
const MIN_AVATAR_QUALITY = 0.52;
const MAX_IMAGE_SIZE_LABEL = "500 KB";
const MONTH_OPTIONS = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Agu" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Okt" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Des" },
];

function splitDateParts(value?: string) {
  const [year = "", month = "", day = ""] = (value ?? "").split("-");
  return { year, month, day };
}

function getDaysInMonth(month: string, year: string): number {
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  if (!monthNumber || !yearNumber) return 31;
  return new Date(yearNumber, monthNumber, 0).getDate();
}

function buildDateValue(year: string, month: string, day: string): string {
  if (!year || !month || !day) return "";
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Foto tidak bisa diproses."));
    };

    image.src = objectUrl;
  });
}

function renderAvatarCanvas(image: HTMLImageElement, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas tidak tersedia.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function compressCanvas(canvas: HTMLCanvasElement) {
  let quality = INITIAL_AVATAR_QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (estimateDataUrlBytes(dataUrl) > MAX_IMAGE_SIZE_BYTES && quality > MIN_AVATAR_QUALITY) {
    quality = Math.max(MIN_AVATAR_QUALITY, quality - 0.08);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return dataUrl;
}

async function buildSafeAvatarDataUrl(file: File) {
  const image = await loadImage(file);
  let scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(image.width, image.height));

  for (let attempt = 0; attempt < MAX_AVATAR_COMPRESSION_ATTEMPTS; attempt += 1) {
    const canvas = renderAvatarCanvas(image, scale);
    const dataUrl = compressCanvas(canvas);

    if (estimateDataUrlBytes(dataUrl) <= MAX_IMAGE_SIZE_BYTES) {
      return dataUrl;
    }

    scale *= 0.82;
  }

  throw new Error(`Foto terlalu besar. Maksimal ${MAX_IMAGE_SIZE_LABEL} setelah diproses, kalau lebih akan saya abaikan.`);
}

function DateFieldGroup({
  id,
  label,
  day,
  month,
  year,
  required = false,
  onDayChange,
  onMonthChange,
  onYearChange,
}: {
  id: string;
  label: string;
  day: string;
  month: string;
  year: string;
  required?: boolean;
  onDayChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
}) {
  const maxDay = useMemo(() => getDaysInMonth(month, year), [month, year]);
  const dayOptions = useMemo(
    () => Array.from({ length: maxDay }, (_, index) => String(index + 1).padStart(2, "0")),
    [maxDay],
  );

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground mb-1 block">
        {label}
        {required ? " *" : ""}
      </label>
      <div id={id} className="grid grid-cols-[0.9fr_1.1fr_1fr] gap-2">
        <select
          value={day}
          onChange={(e) => onDayChange(e.target.value)}
          required={required}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring"
        >
          <option value="">Tanggal</option>
          {dayOptions.map((itemDay) => (
            <option key={itemDay} value={itemDay}>{itemDay}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => {
            const nextMonth = e.target.value;
            const cappedMaxDay = getDaysInMonth(nextMonth, year);
            onMonthChange(nextMonth);
            if (Number(day) > cappedMaxDay) {
              onDayChange(String(cappedMaxDay).padStart(2, "0"));
            }
          }}
          required={required}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring"
        >
          <option value="">Bulan</option>
          {MONTH_OPTIONS.map((itemMonth) => (
            <option key={itemMonth.value} value={itemMonth.value}>{itemMonth.label}</option>
          ))}
        </select>
        <Input
          type="number"
          inputMode="numeric"
          min="1800"
          max={`${new Date().getFullYear() + 1}`}
          value={year}
          onChange={(e) => {
            const nextYear = e.target.value.replace(/\D/g, "").slice(0, 4);
            const cappedMaxDay = getDaysInMonth(month, nextYear);
            onYearChange(nextYear);
            if (Number(day) > cappedMaxDay) {
              onDayChange(String(cappedMaxDay).padStart(2, "0"));
            }
          }}
          placeholder="Tahun"
          required={required}
          className="h-11 text-sm"
        />
      </div>
    </div>
  );
}

export function MemberForm({
  member,
  title,
  submitLabel,
  defaultGender = "male",
  relatedSpouses = [],
  stepChildOption,
  onSave,
  onCancel,
}: MemberFormProps) {
  const isConstrainedMode = useIsConstrainedMode();
  const initialDateParts = splitDateParts(member?.birthDate ?? new Date().toISOString().slice(0, 10));
  const todayParts = splitDateParts(new Date().toISOString().slice(0, 10));
  const initialDeathDateParts = splitDateParts(member?.deathDate ?? "");
  const initialSpouseStatuses = useMemo(() => {
    const relationshipMap = new Map(
      (member ? getSpouseRelations(member) : []).map((relation) => [relation.spouseId, relation.status ?? "married"]),
    );

    return Object.fromEntries(
      relatedSpouses.map((spouse) => [spouse.id, relationshipMap.get(spouse.id) ?? "married"]),
    ) as Record<string, SpouseRelationStatus>;
  }, [member, relatedSpouses]);
  const [name, setName] = useState(member?.name ?? "");
  const [gender, setGender] = useState<FamilyMember["gender"]>(member?.gender ?? defaultGender);
  const [birthYear, setBirthYear] = useState(initialDateParts.year);
  const [birthMonth, setBirthMonth] = useState(initialDateParts.month);
  const [birthDay, setBirthDay] = useState(initialDateParts.day);
  const [isDeceased, setIsDeceased] = useState(Boolean(member?.deathDate));
  const [deathYear, setDeathYear] = useState(initialDeathDateParts.year || todayParts.year);
  const [deathMonth, setDeathMonth] = useState(initialDeathDateParts.month || todayParts.month);
  const [deathDay, setDeathDay] = useState(initialDeathDateParts.day || todayParts.day);
  const [description, setDescription] = useState(member?.description ?? "");
  const [avatarUrl, setAvatarUrl] = useState(member?.avatarUrl ?? "");
  const [isStepChild, setIsStepChild] = useState(false);
  const [spouseStatuses, setSpouseStatuses] = useState<Record<string, SpouseRelationStatus>>(initialSpouseStatuses);
  const [avatarError, setAvatarError] = useState("");
  const [formError, setFormError] = useState("");
  const birthDate = useMemo(() => buildDateValue(birthYear, birthMonth, birthDay), [birthDay, birthMonth, birthYear]);
  const deathDate = useMemo(
    () => (isDeceased ? buildDateValue(deathYear, deathMonth, deathDay) : ""),
    [deathDay, deathMonth, deathYear, isDeceased],
  );

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setAvatarError(`Ukuran gambar maksimal ${MAX_IMAGE_SIZE_LABEL}. Kalau lebih besar, fotonya tidak saya tampilkan supaya browser tetap aman.`);
      e.target.value = "";
      return;
    }

    try {
      const safeAvatarUrl = await buildSafeAvatarDataUrl(file);
      setAvatarUrl(safeAvatarUrl);
      setAvatarError("");
    } catch (error) {
      setAvatarError(
        error instanceof Error
          ? error.message
          : `Foto terlalu besar. Maksimal ${MAX_IMAGE_SIZE_LABEL}, kalau lebih akan saya abaikan.`,
      );
    } finally {
      e.target.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !birthDate) return;
    if (isDeceased && !deathDate) return;
    if (isDeceased && deathDate < birthDate) {
      setFormError("Tanggal meninggal tidak boleh lebih awal dari tanggal lahir.");
      return;
    }

    setFormError("");

    onSave({
      name: name.trim(),
      gender,
      birthDate,
      deathDate: isDeceased ? deathDate : undefined,
      description: description.trim(),
      avatarUrl: avatarUrl || undefined,
      isStepChild,
      spouseStatuses,
    });
  };

  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 animate-fade-in sm:items-center"
      style={{
        paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 1rem))",
        paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 1rem))",
        contain: "layout paint style",
        willChange: "opacity",
      }}
      onClick={onCancel}
    >
      <div
        className={cn(
          "absolute inset-0 bg-foreground/20",
          !isConstrainedMode && "backdrop-blur-sm",
        )}
      />
      <div
        className="glass-card rounded-2xl p-6 max-w-md w-full relative z-10 animate-reveal-up shadow-2xl"
        style={{
          contain: "layout paint style",
          willChange: "transform, opacity",
          transform: "translateZ(0)",
          backdropFilter: isConstrainedMode ? "none" : undefined,
          WebkitBackdropFilter: isConstrainedMode ? "none" : undefined,
          backgroundColor: isConstrainedMode ? "hsl(var(--background) / 0.96)" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary transition-colors active:scale-95"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <h2 className="font-display text-xl text-foreground mb-5">
          {title ?? (member ? "Edit Anggota" : "Tambah Anggota")}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name || "Preview foto"} className="h-20 w-20 rounded-2xl object-cover ring-2 ring-border" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <label htmlFor="avatar-upload" className="text-xs font-medium text-muted-foreground mb-1 block">
                    Foto Anggota
                  </label>
                  <Input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} />
                </div>
                
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl("");
                      setAvatarError("");
                    }}
                    className="inline-flex items-center gap-1 text-xs text-destructive hover:opacity-80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus foto
                  </button>
                )}
                {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="member-name" className="text-xs font-medium text-muted-foreground mb-1 block">Nama Lengkap *</label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masukkan nama"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Jenis Kelamin *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  gender === "male" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                Laki-laki
              </button>
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  gender === "female" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                Perempuan
              </button>
            </div>
          </div>

          <DateFieldGroup
            id="member-birthdate"
            label="Tanggal Lahir"
            day={birthDay}
            month={birthMonth}
            year={birthYear}
            required
            onDayChange={setBirthDay}
            onMonthChange={setBirthMonth}
            onYearChange={setBirthYear}
          />

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status Kehidupan</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeceased(false);
                  setFormError("");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  !isDeceased ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                Masih hidup
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDeceased(true);
                  setFormError("");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isDeceased ? "bg-secondary-foreground text-secondary" : "bg-secondary text-secondary-foreground"
                }`}
              >
                Sudah meninggal
              </button>
            </div>
          </div>

          {isDeceased && (
            <DateFieldGroup
              id="member-deathdate"
              label="Tanggal Meninggal"
              day={deathDay}
              month={deathMonth}
              year={deathYear}
              required
              onDayChange={setDeathDay}
              onMonthChange={setDeathMonth}
              onYearChange={setDeathYear}
            />
          )}

          {relatedSpouses.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Status Hubungan</p>
               
              </div>
              {relatedSpouses.map((spouse) => {
                const currentStatus = spouseStatuses[spouse.id] ?? "married";

                return (
                  <div key={spouse.id} className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{spouse.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
                      <button
                        type="button"
                        onClick={() => setSpouseStatuses((prev) => ({ ...prev, [spouse.id]: "married" }))}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          currentStatus === "married"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        Menikah
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpouseStatuses((prev) => ({ ...prev, [spouse.id]: "divorced" }))}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          currentStatus === "divorced"
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        Cerai
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {stepChildOption && (
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Relasi Anak</p>
                
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/70 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isStepChild}
                  onChange={(e) => setIsStepChild(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border text-destructive focus:ring-destructive"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    Anak sambung untuk {stepChildOption.stepParentName}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Anak tetap berada di keluarga {stepChildOption.biologicalParentName} seperti biasa, hanya penanda garisnya yang berubah oranye.
                  </span>
                </span>
              </label>
            </div>
          )}

          {formError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {formError}
            </p>
          )}

          <div>
            <label htmlFor="member-description" className="text-xs font-medium text-muted-foreground mb-1 block">Deskripsi Singkat</label>
            <textarea
              id="member-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ceritakan sedikit tentang anggota ini..."
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[96px] resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Batal
            </Button>
            <Button type="submit" className="flex-1">
              {submitLabel ?? (member ? "Simpan" : "Tambah")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modal, document.body);
  }

  return modal;
}
