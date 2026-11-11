import Model from 'react-body-highlighter'
import { MUSCLE_OPTIONS, type Muscle } from '../types'

interface Props { primary: Muscle[]; secondary: Muscle[] }

const PRIMARY = '#c8ff4d'
const SECONDARY = '#5e7a2a'
const BODY = '#2a3142'

const label = (m: Muscle) => MUSCLE_OPTIONS.find((o) => o.slug === m)?.label ?? m

/** Front and back body silhouettes with the target muscles lit up. */
export function MuscleMap({ primary, secondary }: Props) {
  // frequency 2 -> primary colour, 1 -> secondary colour (index = frequency - 1)
  const data = [
    { name: 'secondary', muscles: secondary, frequency: 1 },
    { name: 'primary', muscles: primary, frequency: 2 },
  ]
  const names = (list: Muscle[]) =>
    [...new Set(list.filter((m) => !['left-soleus', 'right-soleus'].includes(m)).map(label))].join(', ')
  return (
    <div className="muscle-map" aria-label="Target muscles">
      <div className="bodies">
        {(['anterior', 'posterior'] as const).map((type) => (
          <div className="body" key={type}>
            <Model type={type} data={data} bodyColor={BODY} highlightedColors={[SECONDARY, PRIMARY]} style={{ width: '100%', padding: 0 }} />
            <span className="lbl">{type === 'anterior' ? 'Front' : 'Back'}</span>
          </div>
        ))}
      </div>
      <div className="muscle-legend">
        {primary.length > 0 && (
          <>
            <div className="k"><span className="sw" style={{ background: PRIMARY }} />Primary</div>
            <div className="names">{names(primary)}</div>
          </>
        )}
        {secondary.length > 0 && (
          <>
            <div className="k"><span className="sw" style={{ background: SECONDARY }} />Secondary</div>
            <div className="names">{names(secondary)}</div>
          </>
        )}
      </div>
    </div>
  )
}
