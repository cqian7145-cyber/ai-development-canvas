'use client'

import { Tldraw } from 'tldraw'

export function DesignCanvas() {
  return <div className="design-canvas" style={{ position: 'absolute', inset: 0 }}><Tldraw persistenceKey="adc-phase0-design-canvas" /></div>
}
