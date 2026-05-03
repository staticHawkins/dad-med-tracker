import { useState } from 'react'
import MedGroupHeader from './MedGroupHeader'
import MedRow from './MedRow'
import MedStockedCollapsed from './MedStockedCollapsed'

const GROUP_META = {
  urgent:      { label: 'Refill urgently',   variant: 'urgent',     defaultOpen: true  },
  soon:        { label: 'Refill in 2 weeks', variant: 'soon',       defaultOpen: true  },
  ok:          { label: 'Stocked up',        variant: 'ok',         defaultOpen: false },
  'as-needed': { label: 'As needed',         variant: 'as-needed',  defaultOpen: true  },
}

export default function MedGroupSection({ groupKey, meds, sectionRef, onOpen, forceOpen = false }) {
  const meta = GROUP_META[groupKey]
  const [isOpen, setIsOpen] = useState(meta.defaultOpen || forceOpen)

  if (!meds.length) return null

  const isStocked = groupKey === 'ok'

  return (
    <div className={`med-group med-group-${meta.variant}`} ref={sectionRef}>
      {(!isStocked || isOpen) && (
        <MedGroupHeader
          label={meta.label}
          count={meds.length}
          variant={meta.variant}
          isOpen={isOpen}
          onToggle={isStocked ? () => setIsOpen(o => !o) : null}
        />
      )}
      <div className="med-group-body">
        {isOpen
          ? meds.map(m => (
              <MedRow key={m.id} m={m} onOpen={() => onOpen(m.id)} />
            ))
          : (
              <MedStockedCollapsed
                items={meds}
                onShow={() => { setIsOpen(true) }}
              />
            )
        }
      </div>
    </div>
  )
}
