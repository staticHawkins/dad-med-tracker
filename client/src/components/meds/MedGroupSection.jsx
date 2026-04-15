import { useState } from 'react'
import MedGroupHeader from './MedGroupHeader'
import MedRow from './MedRow'
import MedStockedCollapsed from './MedStockedCollapsed'

const GROUP_META = {
  urgent: { label: 'Refill urgently', variant: 'urgent', defaultOpen: true },
  soon:   { label: 'Refill this week', variant: 'soon',   defaultOpen: true },
  ok:     { label: 'Stocked up',       variant: 'ok',     defaultOpen: false },
}

export default function MedGroupSection({ groupKey, meds, sectionRef, onEdit }) {
  const meta = GROUP_META[groupKey]
  const [isOpen, setIsOpen] = useState(meta.defaultOpen)
  const [expandedId, setExpandedId] = useState(null)

  if (!meds.length) return null

  function toggleRow(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const isStocked = groupKey === 'ok'

  return (
    <div className={`med-group med-group-${meta.variant}`} ref={sectionRef}>
      {/* Header only shown when group is expanded (stocked) or always (urgent/soon) */}
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
              <MedRow
                key={m.id}
                m={m}
                onEdit={onEdit}
                isExpanded={expandedId === m.id}
                onToggleExpand={() => toggleRow(m.id)}
              />
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
