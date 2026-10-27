import type { ReactNode } from 'react';
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
  extra,
  compact = false,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  selects: FilterSelect[];
  onClear: () => void;
  // Acción extra en la misma fila (R1b: «Más filtros» de
  // Oportunidades). Opcional; sin ella la barra es la de R1.
  extra?: ReactNode;
  // R1c: con compact=true los campos son más bajos (h-9) y la
  // fila más densa; sin ella la barra es la de R1/R1b.
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-end ${compact ? 'gap-2' : 'gap-3'}`}>
      <div>
        <Label htmlFor="filter-search">Buscar</Label>
        <Input
          id="filter-search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className={compact ? 'h-9' : undefined}
        />
      </div>
      {selects.map((s) => (
        <div key={s.id}>
          <Label htmlFor={s.id}>{s.label}</Label>
          <select
            id={s.id}
            value={s.value}
            onChange={(e) => s.onChange(e.target.value)}
            className={`w-full px-3 text-sm bg-surface text-ink border border-border rounded-control ${
              compact ? 'h-9 py-0' : 'py-2'
            }`}
          >
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {extra}
      <Button type="button" variant="secondary" onClick={onClear}>
        Limpiar
      </Button>
    </div>
  );
}
