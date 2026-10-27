// Pestañas compartidas (R1): solo botones con aria-selected; el
// contenido lo renderiza la vista según la pestaña activa. Solo
// se crean pestañas con contenido real: si una quedaría vacía o
// inventada, no se crea.
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Secciones del detalle" className="flex gap-1 border-b border-border overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
            active === t.id ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
