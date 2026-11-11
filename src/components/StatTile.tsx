import { ArrowDown, ArrowUp, Dash } from './Icons'

interface Props {
  label: string
  value: string
  unit?: string
  delta?: number
  deltaUnit?: string
}

export function StatTile({ label, value, unit, delta, deltaUnit }: Props) {
  const dir = delta === undefined ? undefined : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value num">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {dir && (
        <div className={`delta ${dir} num`}>
          {dir === 'up' ? <ArrowUp /> : dir === 'down' ? <ArrowDown /> : <Dash />}
          {dir === 'flat' ? 'no change' : `${Math.abs(delta!) % 1 === 0 ? Math.abs(delta!) : Math.abs(delta!).toFixed(1)}${deltaUnit ? ` ${deltaUnit}` : ''}`}
        </div>
      )}
    </div>
  )
}
