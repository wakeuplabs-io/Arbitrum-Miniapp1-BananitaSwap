import { createFileRoute } from "@tanstack/react-router";
import { usePlaceholder } from "@/hooks/use-placeholder";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/placeholder/")({
  component: Placeholder,
});

function Placeholder() {
  const { data, isLoading, error } = usePlaceholder();

  return (
    <div className="flex flex-col flex-1 items-center justify-center w-full min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6 lg:p-8">
      <section className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Placeholder
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Información del placeholder mockeado
          </p>
        </div>

        {isLoading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              Cargando placeholder...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-red-800 dark:text-red-400 font-semibold mb-1">
                  Error al cargar placeholder
                </h3>
                <p className="text-red-600 dark:text-red-300 text-sm">
                  {error.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {data && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 md:p-8 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Datos del Placeholder
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 sm:mb-0">
                  ID
                </span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  #{data.id}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 sm:mb-0">
                  Nombre
                </span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {data.name}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 sm:mb-0">
                  Fecha de Creación
                </span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {new Date(data.createdAt).toLocaleString("es-ES", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
