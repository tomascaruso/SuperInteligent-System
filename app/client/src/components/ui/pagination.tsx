import { Button } from './button';

// Paginación en cliente (R1): el servidor devuelve hasta 100
// filas sin paginar, así que la vista pagina en cliente y lo
// dice con el texto «Mostrando X a Y de Z».
export function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-secondary">
        Mostrando {from} a {to} de {total}
      </p>
      <Button type="button" variant="secondary" size="sm" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </Button>
    </div>
  );
}
