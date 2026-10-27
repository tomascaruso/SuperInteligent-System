import { ArrowUpRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

// Estado honesto de cada sección durante la migración (Fase 3):
// las vistas con datos reales son la Fase 4 y NO se simulan acá.
// Solo el título real, una línea de qué contiene esa vista en la
// app actual y un enlace real a / (la app vanilla completa) como
// puente. Nada de contadores ni datos inventados.
export function SectionPlaceholder({ title, about }: { title: string; about: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mt-0">{title}</h2>
      <Card>
        <p className="text-secondary mt-0">{about}</p>
        <p className="text-secondary">
          Esta vista se está migrando a React en la Fase 4. Mientras tanto, la versión completa funciona en la
          aplicación actual.
        </p>
        <div className="mt-4">
          <Button type="button" onClick={() => (window.location.href = '/')}>
            Ir a la aplicación actual <ArrowUpRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
