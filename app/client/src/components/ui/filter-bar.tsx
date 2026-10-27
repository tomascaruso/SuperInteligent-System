import { Button } from './button';
import { Input } from './input';
import { Label } from './label';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelect {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

// Barra de filtros compartida (R1): buscador + selects con los
// valores reales de cada sección (nunca listas copiadas de una
// imagen) + «Limpiar». Todos los filtros son en cliente: el
// servidor no expone query params para esto.
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  selects,
  onClear,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  selects: FilterSelect[];
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <Label htmlFor="filter-search">Buscar</Label>
        <Input
          id="filter-search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      {selects.map((s) => (
        <div key={s.id}>
          <Label htmlFor={s.id}>{s.label}</Label>
          <select
            id={s.id}
            value={s.value}
            onChange={(e) => s.onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-surface text-ink border border-border rounded-control"
          >
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={onClear}>
        Limpiar
      </Button>
    </div>
  );
}
