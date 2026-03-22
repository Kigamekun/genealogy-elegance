import { useState } from "react";
import { FamilyMember } from "@/lib/family-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export interface MemberFormValues {
  name: string;
  gender: FamilyMember["gender"];
  description: string;
}

interface MemberFormProps {
  member?: FamilyMember;
  title?: string;
  submitLabel?: string;
  defaultGender?: FamilyMember["gender"];
  onSave: (values: MemberFormValues) => void;
  onCancel: () => void;
}

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
  const [description, setDescription] = useState(member?.description ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      gender,
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onCancel}>
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
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nama Lengkap *</label>
            <Input
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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Deskripsi Singkat</label>
            <textarea
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
}
