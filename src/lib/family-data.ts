import avatarAhmad from "@/assets/avatar-ahmad.jpg";
import avatarSiti from "@/assets/avatar-siti.jpg";
import avatarBudi from "@/assets/avatar-budi.jpg";
import avatarDewi from "@/assets/avatar-dewi.jpg";
import avatarRatna from "@/assets/avatar-ratna.jpg";
import avatarHendra from "@/assets/avatar-hendra.jpg";
import avatarFajar from "@/assets/avatar-fajar.jpg";
import avatarAnisa from "@/assets/avatar-anisa.jpg";
import avatarRizky from "@/assets/avatar-rizky.jpg";

export interface FamilyMember {
  id: string;
  name: string;
  birthDate: string;
  deathDate?: string;
  gender: "male" | "female";
  relation: string;
  description: string;
  avatarUrl?: string;
  parentId?: string;
  spouseId?: string;
  generation: number;
}

const initialMembers: FamilyMember[] = [
  {
    id: "1", name: "Ahmad Suryadi", birthDate: "1940-03-15", deathDate: "2015-08-20",
    gender: "male", relation: "Kakek",
    description: "Pendiri keluarga besar Suryadi, seorang guru besar di Universitas Gadjah Mada.",
    avatarUrl: avatarAhmad, generation: 1,
  },
  {
    id: "2", name: "Siti Rahayu", birthDate: "1945-07-22",
    gender: "female", relation: "Nenek",
    description: "Ibu dari tiga anak, dikenal sebagai perajin batik yang berbakat.",
    avatarUrl: avatarSiti, spouseId: "1", generation: 1,
  },
  {
    id: "3", name: "Budi Suryadi", birthDate: "1968-01-10",
    gender: "male", relation: "Ayah",
    description: "Anak sulung, bekerja sebagai dokter spesialis di Jakarta.",
    avatarUrl: avatarBudi, parentId: "1", generation: 2,
  },
  {
    id: "4", name: "Dewi Lestari", birthDate: "1970-11-05",
    gender: "female", relation: "Ibu",
    description: "Istri Budi, seorang arsitek yang merancang berbagai bangunan ikonik.",
    avatarUrl: avatarDewi, spouseId: "3", generation: 2,
  },
  {
    id: "5", name: "Ratna Suryadi", birthDate: "1972-06-18",
    gender: "female", relation: "Bibi",
    description: "Anak kedua, seorang pengusaha kuliner sukses di Yogyakarta.",
    avatarUrl: avatarRatna, parentId: "1", generation: 2,
  },
  {
    id: "6", name: "Hendra Wijaya", birthDate: "1971-09-30",
    gender: "male", relation: "Paman",
    description: "Suami Ratna, seorang seniman dan fotografer profesional.",
    avatarUrl: avatarHendra, spouseId: "5", generation: 2,
  },
  {
    id: "7", name: "Fajar Suryadi", birthDate: "1995-04-12",
    gender: "male", relation: "Anak",
    description: "Anak pertama Budi, mahasiswa S2 teknik informatika.",
    avatarUrl: avatarFajar, parentId: "3", generation: 3,
  },
  {
    id: "8", name: "Anisa Suryadi", birthDate: "1998-12-25",
    gender: "female", relation: "Anak",
    description: "Anak kedua Budi, seorang desainer grafis berbakat.",
    avatarUrl: avatarAnisa, parentId: "3", generation: 3,
  },
  {
    id: "9", name: "Rizky Wijaya", birthDate: "1997-08-08",
    gender: "male", relation: "Sepupu",
    description: "Anak Ratna dan Hendra, seorang musisi dan komposer.",
    avatarUrl: avatarRizky, parentId: "5", generation: 3,
  },
];

export function getInitialMembers(): FamilyMember[] {
  return [...initialMembers];
}

export function getChildren(members: FamilyMember[], parentId: string): FamilyMember[] {
  return members.filter((m) => m.parentId === parentId);
}

export function getSpouse(members: FamilyMember[], memberId: string): FamilyMember | undefined {
  const member = members.find((m) => m.id === memberId);
  if (!member) return undefined;
  if (member.spouseId) return members.find((m) => m.id === member.spouseId);
  return members.find((m) => m.spouseId === memberId);
}

export function getRootMembers(members: FamilyMember[]): FamilyMember[] {
  return members.filter((m) => !m.parentId && !m.spouseId);
}
