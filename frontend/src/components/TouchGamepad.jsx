import { useRef, useEffect, useState } from 'react'

/**
 * Controle virtual para celular/tablet.
 * Emite eventos de teclado compatíveis com EmulatorJS.
 * Aparece automaticamente no modo touch dentro do player.
 */

// Mapa de botões → teclas que o EmulatorJS entende
const KEY_MAP = {
  UP:     'ArrowUp',
  DOWN:   'ArrowDown',
  LEFT:   'ArrowLeft',
  RIGHT:  'ArrowRight',
  A:      'z',
  B:      'x',
  X:      'a',
  Y:      's',
  L:      'q',
  R:      'w',
  START:  'Enter',
  SELECT: 'Shift',
}

function pressKey(key, down) {
  const type = down ? 'keydown' : 'keyup'
  // Dispara no iframe do emulador também
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true })
  document.dispatchEvent(event)
  const iframe = document.querySelector('iframe')
  try { iframe?.contentDocument?.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true })) } catch {}
}

function TouchBtn({ label, keyName, className = '', style = {} }) {
  const held = useRef(false)

  const start = (e) => {
    e.preventDefault()
    if (held.current) return
    held.current = true
    pressKey(keyName, true)
  }
  const end = (e) => {
    e.preventDefault()
    held.current = false
    pressKey(keyName, false)
  }

  return (
    <button
      onTouchStart={start}
      onTouchEnd={end}
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={end}
      className={`select-none touch-none flex items-center justify-center
                  font-bold text-white rounded-full active:scale-90 transition-transform
                  bg-white/20 border border-white/30 backdrop-blur-sm ${className}`}
      style={style}
    >
      {label}
    </button>
  )
}

// D-pad com joystick virtual
function DPad() {
  const padRef = useRef(null)
  const activeRef = useRef(new Set())

  const getDir = (x, y) => {
    const dirs = []
    if (y < -0.3) dirs.push('UP')
    if (y >  0.3) dirs.push('DOWN')
    if (x < -0.3) dirs.push('LEFT')
    if (x >  0.3) dirs.push('RIGHT')
    return dirs
  }

  const handleTouch = (e) => {
    e.preventDefault()
    const pad = padRef.current
    if (!pad) return
    const rect = pad.getBoundingClientRect()
    const cx = rect.left + rect.width  / 2
    const cy = rect.top  + rect.height / 2

    const touch = e.touches[0]
    const nx = touch ? (touch.clientX - cx) / (rect.width  / 2) : 0
    const ny = touch ? (touch.clientY - cy) / (rect.height / 2) : 0

    const newDirs = new Set(getDir(nx, ny))
    const oldDirs = activeRef.current

    // Solta direções que não estão mais ativas
    for (const d of oldDirs) {
      if (!newDirs.has(d)) pressKey(KEY_MAP[d], false)
    }
    // Pressiona novas direções
    for (const d of newDirs) {
      if (!oldDirs.has(d)) pressKey(KEY_MAP[d], true)
    }
    activeRef.current = newDirs
  }

  const release = (e) => {
    e.preventDefault()
    for (const d of activeRef.current) pressKey(KEY_MAP[d], false)
    activeRef.current = new Set()
  }

  return (
    <div
      ref={padRef}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      onTouchEnd={release}
      className="relative touch-none select-none"
      style={{ width: 120, height: 120 }}
    >
      {/* Círculo de fundo */}
      <div className="absolute inset-0 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm" />
      {/* Setas decorativas */}
      <div className="absolute inset-0 flex items-start justify-center pt-2 text-white/60 text-lg pointer-events-none">▲</div>
      <div className="absolute inset-0 flex items-end justify-center pb-2 text-white/60 text-lg pointer-events-none">▼</div>
      <div className="absolute inset-0 flex items-center justify-start pl-2 text-white/60 text-lg pointer-events-none">◀</div>
      <div className="absolute inset-0 flex items-center justify-end pr-2 text-white/60 text-lg pointer-events-none">▶</div>
      {/* Centro */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30" />
      </div>
    </div>
  )
}

export default function TouchGamepad({ visible = true }) {
  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-end justify-between px-4 pb-4 pointer-events-auto">

        {/* Esquerda: D-pad */}
        <div className="flex flex-col items-center gap-3">
          <DPad />
          {/* SELECT */}
          <TouchBtn label="SEL" keyName={KEY_MAP.SELECT}
            className="text-xs" style={{ width: 52, height: 26 }} />
        </div>

        {/* Centro: Start */}
        <TouchBtn label="START" keyName={KEY_MAP.START}
          className="text-xs mb-10" style={{ width: 72, height: 28 }} />

        {/* Direita: botões de ação */}
        <div className="flex flex-col items-center gap-1">
          {/* Linha Y */}
          <TouchBtn label="Y" keyName={KEY_MAP.Y}
            style={{ width: 44, height: 44 }}
            className="bg-yellow-500/40 border-yellow-400/50" />
          {/* Linha X - A */}
          <div className="flex gap-1">
            <TouchBtn label="X" keyName={KEY_MAP.X}
              style={{ width: 44, height: 44 }}
              className="bg-blue-500/40 border-blue-400/50" />
            <TouchBtn label="A" keyName={KEY_MAP.A}
              style={{ width: 44, height: 44 }}
              className="bg-green-500/40 border-green-400/50" />
          </div>
          {/* Linha B */}
          <TouchBtn label="B" keyName={KEY_MAP.B}
            style={{ width: 44, height: 44 }}
            className="bg-red-500/40 border-red-400/50" />
        </div>
      </div>

      {/* Botões L e R no topo */}
      <div className="absolute top-0 left-0 right-0 flex justify-between px-4 pt-2 pointer-events-auto">
        <TouchBtn label="L" keyName={KEY_MAP.L}
          style={{ width: 56, height: 28 }} className="text-xs rounded-lg" />
        <TouchBtn label="R" keyName={KEY_MAP.R}
          style={{ width: 56, height: 28 }} className="text-xs rounded-lg" />
      </div>
    </div>
  )
}
