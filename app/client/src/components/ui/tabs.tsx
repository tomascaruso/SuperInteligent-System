// Pestañas compartidas (R1): solo botones con aria-selected; el
// contenido lo renderiza la vista según la pestaña activa. Solo
// se crean pestañas con contenido real: si una quedaría vacía o
// inventada, no se crea.
export function Tabs({
  tabs,
  active,
  onChange,
  scrollable = true,
  idPrefix,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  // R1c: con scrollable={false} las pestañas envuelven en vez
  // de generar una barra horizontal interna (Oportunidades).
  scrollable?: boolean;
  // A1, P3-4: si se pasa, cada pestaña recibe id y aria-controls
  // para que la vista envuelva su contenido en un tabpanel.
  idPrefix?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Secciones del detalle"
      className={`flex gap-1 border-b border-border ${scrollable ? 'overflow-x-auto' : 'flex-wrap'}`}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={idPrefix ? `${idPrefix}-tab-${t.id}` : undefined}
          aria-controls={idPrefix ? `${idPrefix}-panel-${t.id}` : undefined}
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
