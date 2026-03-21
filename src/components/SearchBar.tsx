import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  generationFilter: number | null;
  onGenerationChange: (g: number | null) => void;
  generations: number[];
}

export function SearchBar({
  query,
  onQueryChange,
  generationFilter,
  onGenerationChange,
  generations,
}: SearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Cari anggota keluarga..."
          className="pl-9 pr-8 bg-background/60 backdrop-blur-sm"
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex gap-1">
          <button
            onClick={() => onGenerationChange(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              generationFilter === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Semua
          </button>
          {generations.map((g) => (
            <button
              key={g}
              onClick={() => onGenerationChange(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                generationFilter === g
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Gen {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
