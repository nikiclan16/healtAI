import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { ShapFactor } from '@/services/types'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

/** RF04.3 — Top 3 SHAP: rojo = empuja hacia Ruta A, verde = factor protector. */
export function ShapChart({ factors }: { factors: ShapFactor[] }) {
  return (
    <div className="h-44 w-full">
      <Bar
        aria-label="Contribución de las 3 variables principales"
        data={{
          labels: factors.map((f) => `${f.etiqueta} (${f.valor > 0 ? '+' : ''}${f.valor.toFixed(3)})`),
          datasets: [
            {
              label: 'Impacto Local en Probabilidad P(RA)',
              data: factors.map((f) => f.valor),
              backgroundColor: factors.map((f) => (f.direccion === 'riesgo' ? '#E63946' : '#008558')),
              borderRadius: 4,
            },
          ],
        }}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#e2e8f0' }, ticks: { font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } },
          },
        }}
      />
    </div>
  )
}
