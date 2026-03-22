import { useState } from "react";
import { createPortal } from "react-dom";
import { FamilyMember } from "@/lib/family-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, ImagePlus, Trash2, X } from "lucide-react";

export interface MemberFormValues {
  name: string;
  gender: FamilyMember["gender"];
  birthDate: string;
  description: string;
  avatarUrl?: string;
}

interface MemberFormProps {
  member?: FamilyMember;
  title?: string;
  submitLabel?: string;
  defaultGender?: FamilyMember["gender"];
  onSave: (values: MemberFormValues) => void;
  onCancel: () => void;
}

const MAX_IMAGE_SIZE_MB = 1.5;

export function MemberForm({
  member,
  title,
  submitLabel,
  defaultGender = "male",
  onSave,
  onCancel,
}: MemberFormProps) {
  const [name, setName] = useState(member?.name ?? "");
  const [gender, setGender] = useState<FamilyMember["gender"]>(member?.gender ?? defaultGender);
  const [birthDate, setBirthDate] = useState(member?.birthDate ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(member?.description ?? "");
  const [avatarUrl, setAvatarUrl] = useState(member?.avatarUrl ?? "");
  const [avatarError, setAvatarError] = useState("");

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setAvatarError(`Ukuran gambar maksimal ${MAX_IMAGE_SIZE_MB} MB supaya aman disimpan di browser.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
        setAvatarError("");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !birthDate) return;

    onSave({
      name: name.trim(),
      gender,
      birthDate,
      description: description.trim(),
      avatarUrl: avatarUrl || undefined,
    });
  };

  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 animate-fade-in sm:items-center"
      style={{
        paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 1rem))",
        paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 1rem))",
      }}
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
      <div
        className="glass-card rounded-2xl p-6 max-w-md w-full relative z-10 animate-reveal-up shadow-2xl"
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
            <div className="flex items-center gap-4">
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
                <p className="text-[11px] text-muted-foreground">
                  Foto disimpan di browser agar tetap berjalan tanpa backend.
                </p>
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

          <div>
            <label htmlFor="member-birthdate" className="text-xs font-medium text-muted-foreground mb-1 block">
              Tanggal Lahir *
            </label>
            <div className="relative">
              <Input
                id="member-birthdate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                className="pr-10"
              />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

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
