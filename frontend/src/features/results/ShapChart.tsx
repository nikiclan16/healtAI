import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { ShapFactor } from '@/services/types'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

/** RF04.3 — Top 3 SHAP: rojo = empuja hacia Ruta A, verde = factor protector. */
export function ShapChart({ factors }: { factors: ShapFactor[] }) {
  return (
    <div className="h-48">
      <Bar
        aria-label="Contribución de las 3 variables principales"
        data={{
          labels: factors.map((f) => f.etiqueta),
          datasets: [
            {
              data: factors.map((f) => f.valor),
              backgroundColor: factors.map((f) => (f.direccion === 'riesgo' ? '#e63946' : '#008558')),
            },
          ],
        }}
        options={{
          indexAxis: 'y',
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { title: { display: true, text: 'Contribución (SHAP)' } } },
        }}
      />
    </div>
  )
}
