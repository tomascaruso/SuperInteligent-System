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
  textSize = 'text-sm',
}: {
  headers: string[];
  children: ReactNode;
  empty: boolean;
  emptyText: string;
  scrollable?: boolean;
  // R1g: tamaño de fuente de la tabla (por defecto el de R1).
  // Oportunidades usa text-[13px] para que las 7 columnas
  // quepan dentro de su tarjeta sin desbordar.
  textSize?: string;
}) {
  return (
    <div className={scrollable ? 'overflow-x-auto' : 'min-w-0'}>
      <table className={`w-full border-collapse ${textSize}`}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className={`text-left py-2 border-b border-border text-secondary font-medium ${
                  scrollable ? 'px-3' : 'px-1.5 break-words'
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
