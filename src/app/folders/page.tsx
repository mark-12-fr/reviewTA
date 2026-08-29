'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import type { Folder } from '@/types'

const folderColors = [
  { value: 'bg-m3', label: 'Rust' },
  { value: 'bg-ink', label: 'Ink' },
  { value: 'bg-correct', label: 'Green' },
  { value: 'bg-wrong', label: 'Red' },
  { value: 'bg-m2', label: 'Amber' },
  { value: 'bg-rule-strong', label: 'Grey' },
]

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(folderColors[0].value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/folders')
      .then((response) => (response.ok ? response.json() : []))
      .then(setFolders)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      if (response.ok) {
        const folder = await response.json()
        setFolders((current) => [folder, ...current])
        setModalOpen(false)
        setName('')
      }
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    const response = await fetch(`/api/folders/${id}`, { method: 'DELETE' })
    if (response.ok) setFolders((current) => current.filter((folder) => folder.id !== id))
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex items-end justify-between gap-4 border-b border-rule pb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Folders</h1>
          <p className="mt-1.5 font-mono text-[12px] tabular-nums text-ink-3">
            {loading ? 'Loading' : `${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}`}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New folder</Button>
      </header>

      {loading ? (
        <div className="h-32 animate-pulse rounded-lg border border-rule bg-sunken/60" />
      ) : folders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule-strong px-6 py-12 text-center">
          <p className="text-[14px] font-medium text-ink">No folders yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-ink-2">
            Group study sets by subject. Open any set and pick a folder to file it.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-rule border-t border-rule">
          {folders.map((folder) => (
            <li key={folder.id} className="group flex items-center gap-4 py-3.5">
              <span className={`h-1 w-6 flex-shrink-0 rounded-full ${folder.color}`} />
              <Link href={`/folders/${folder.id}`} className="min-w-0 flex-1 truncate">
                <span className="text-[15px] font-medium text-ink group-hover:text-accent">
                  {folder.name}
                </span>
              </Link>
              <span className="font-mono text-[12px] tabular-nums text-ink-3">
                {folder.studySetCount} sets
              </span>
              <button
                onClick={() => remove(folder.id)}
                aria-label={`Delete ${folder.name}`}
                className="cursor-pointer rounded-md p-1.5 text-ink-3 opacity-0 transition-all hover:bg-sunken hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 6.5h15M9 6.5V5a1 1 0 011-1h4a1 1 0 011 1v1.5M6.5 6.5l.7 12a1 1 0 001 .9h7.6a1 1 0 001-.9l.7-12"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New folder">
        <div className="space-y-5">
          <Input
            id="folder-name"
            label="Name"
            placeholder="Analytics"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create()
            }}
          />
          <div className="space-y-2">
            <span className="eyebrow block">Colour</span>
            <div className="flex gap-2">
              {folderColors.map((entry) => (
                <button
                  key={entry.value}
                  onClick={() => setColor(entry.value)}
                  aria-label={entry.label}
                  aria-pressed={color === entry.value}
                  className={`h-7 w-7 cursor-pointer rounded-full ${entry.value} ${
                    color === entry.value ? 'ring-2 ring-ink ring-offset-2' : ''
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 border-t border-rule pt-4">
            <Button onClick={create} disabled={!name.trim() || saving}>
              {saving ? 'Creating' : 'Create'}
            </Button>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
