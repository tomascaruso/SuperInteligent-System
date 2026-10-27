import type { ReactNode } from 'react';

// Tabla compartida (R1): cabecera fija, celdas con los tokens
// SIS y fila de estado vacío. Las filas las renderiza la vista
// (clicables o no, según la sección); el componente no inventa
// columnas ni datos.
export function Table({
  headers,
  children,
  empty,
  emptyText,
}: {
  headers: string[];
  children: ReactNode;
  empty: boolean;
  emptyText: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 border-b border-border text-secondary font-medium">
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
