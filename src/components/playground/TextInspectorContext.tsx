import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

type Overrides = Record<string, Record<string, string>> // domPath → { cssProp: value }

export interface TypographyPreset {
  id: string
  name: string
  props: Record<string, string> // only overridden CSS props
  createdAt: number
}

const PRESETS_KEY = 'text-inspector:presets'

function loadPresets(): TypographyPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistPresets(presets: TypographyPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
}

interface TextInspectorState {
  enabled: boolean
  selectedElement: HTMLElement | null
  selectedPath: string | null
  overrides: Overrides
  activeVariant: string
  presets: TypographyPreset[]
  setEnabled: (v: boolean) => void
  select: (el: HTMLElement | null, path: string | null) => void
  setOverride: (path: string, prop: string, value: string) => void
  clearOverride: (path: string, prop: string) => void
  clearAll: () => void
  savePreset: (name: string) => void
  deletePreset: (id: string) => void
  applyPreset: (preset: TypographyPreset) => void
}

const TextInspectorContext = createContext<TextInspectorState | null>(null)

function storageKey(variant: string) {
  return `text-inspector:${variant}`
}

function loadOverrides(variant: string): Overrides {
  try {
    const raw = localStorage.getItem(storageKey(variant))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveOverrides(variant: string, overrides: Overrides) {
  // Clean empty paths before saving
  const cleaned: Overrides = {}
  for (const [path, props] of Object.entries(overrides)) {
    if (Object.keys(props).length > 0) cleaned[path] = props
  }
  if (Object.keys(cleaned).length === 0) {
    localStorage.removeItem(storageKey(variant))
  } else {
    localStorage.setItem(storageKey(variant), JSON.stringify(cleaned))
  }
}

export function TextInspectorProvider({
  activeVariant,
  children,
}: {
  activeVariant: string
  children: ReactNode
}) {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem('text-inspector:enabled') !== '0'
    } catch {
      return true
    }
  })
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides(activeVariant))
  const [presets, setPresets] = useState<TypographyPreset[]>(loadPresets)

  // Load overrides when variant changes
  useEffect(() => {
    setOverrides(loadOverrides(activeVariant))
    setSelectedElement(null)
    setSelectedPath(null)
  }, [activeVariant])

  // Persist overrides to localStorage on change
  useEffect(() => {
    saveOverrides(activeVariant, overrides)
  }, [activeVariant, overrides])

  useEffect(() => {
    try { localStorage.setItem('text-inspector:enabled', enabled ? '1' : '0') } catch { /* ignore */ }
  }, [enabled])

  const select = useCallback((el: HTMLElement | null, path: string | null) => {
    setSelectedElement(el)
    setSelectedPath(path)
  }, [])

  const setOverride = useCallback((path: string, prop: string, value: string) => {
    setOverrides((prev) => ({
      ...prev,
      [path]: { ...prev[path], [prop]: value },
    }))
  }, [])

  const clearOverride = useCallback((path: string, prop: string) => {
    setOverrides((prev) => {
      const pathOverrides = { ...prev[path] }
      delete pathOverrides[prop]
      return { ...prev, [path]: pathOverrides }
    })
  }, [])

  const clearAll = useCallback(() => {
    setOverrides({})
  }, [])

  const OVERRIDE_PROPS = [
    'font-family', 'font-weight', 'font-size', 'line-height',
    'letter-spacing', 'font-style', 'text-transform', 'color',
  ]

  const savePreset = useCallback((name: string) => {
    if (!selectedPath) return
    const props = overrides[selectedPath]
    if (!props || Object.keys(props).length === 0) return
    const preset: TypographyPreset = {
      id: Date.now().toString(36),
      name,
      props: { ...props },
      createdAt: Date.now(),
    }
    setPresets((prev) => {
      const next = [...prev, preset]
      persistPresets(next)
      return next
    })
  }, [selectedPath, overrides])

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id)
      persistPresets(next)
      return next
    })
  }, [])

  const applyPreset = useCallback((preset: TypographyPreset) => {
    if (!selectedPath || !selectedElement) return
    // Apply preset props
    for (const [prop, value] of Object.entries(preset.props)) {
      setOverride(selectedPath, prop, value)
      selectedElement.style.setProperty(prop, value, 'important')
    }
    // Clear overrides not in preset
    for (const prop of OVERRIDE_PROPS) {
      if (!preset.props[prop]) {
        clearOverride(selectedPath, prop)
        selectedElement.style.removeProperty(prop)
      }
    }
  }, [selectedPath, selectedElement, setOverride, clearOverride])

  return (
    <TextInspectorContext.Provider
      value={{
        enabled,
        selectedElement,
        selectedPath,
        overrides,
        activeVariant,
        presets,
        setEnabled,
        select,
        setOverride,
        clearOverride,
        clearAll,
        savePreset,
        deletePreset,
        applyPreset,
      }}
    >
      {children}
    </TextInspectorContext.Provider>
  )
}

export function useTextInspector() {
  const ctx = useContext(TextInspectorContext)
  if (!ctx) throw new Error('useTextInspector must be used within TextInspectorProvider')
  return ctx
}
