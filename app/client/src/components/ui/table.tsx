import type { ReactNode } from 'react';

// Tabla compartida (R1): cabecera fija, celdas con los tokens
// SIS y fila de estado vacío. Las filas las renderiza la vista
// (clicables o no, según la sección); el componente no inventa
// columnas ni datos. Por defecto la tabla tiene scroll
// horizontal interno (comportamiento de R1); con
// scrollable={false} (R1c, Oportunidades) no hay barra interna:
// las celdas envuelven el texto y la tabla cede con el ancho.
export function Table({
  headers,
  children,
  empty,
  emptyText,
  scrollable = true,
}: {
  headers: string[];
  children: ReactNode;
  empty: boolean;
  emptyText: string;
  scrollable?: boolean;
}) {
  return (
    <div className={scrollable ? 'overflow-x-auto' : 'min-w-0'}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className={`text-left px-3 py-2 border-b border-border text-secondary font-medium ${
                  scrollable ? '' : 'break-words'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-4 text-secondary">
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
