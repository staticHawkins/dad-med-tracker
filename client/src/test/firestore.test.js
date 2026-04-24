import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, _col, id) => ({ id })),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  updateDoc: vi.fn(() => Promise.resolve()),
  arrayUnion: vi.fn(v => v),
  writeBatch: vi.fn(),
  deleteField: vi.fn(),
}))

vi.mock('../firebase', () => ({ db: 'mock-db' }))

import { saveTask, updateTaskFields, addComment } from '../lib/firestore'
import { updateDoc, setDoc, doc, arrayUnion } from 'firebase/firestore'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateTaskFields', () => {
  it('calls updateDoc with only the provided fields (+ updatedAt)', async () => {
    await updateTaskFields('task-123', { status: 'in-progress', done: false })

    expect(updateDoc).toHaveBeenCalledOnce()
    expect(setDoc).not.toHaveBeenCalled()

    const [, patch] = updateDoc.mock.calls[0]
    expect(patch).toMatchObject({ status: 'in-progress', done: false })
    expect(patch).toHaveProperty('updatedAt')
    // comments must not be present — this is the key guard against the regression
    expect(patch).not.toHaveProperty('comments')
  })

  it('does not overwrite unrelated fields like comments when changing status', async () => {
    await updateTaskFields('task-123', { status: 'done', done: true })

    const [, patch] = updateDoc.mock.calls[0]
    // Only the fields we passed + updatedAt — nothing else
    expect(Object.keys(patch).sort()).toEqual(['done', 'status', 'updatedAt'].sort())
  })
})

describe('saveTask (new task creation)', () => {
  it('calls setDoc with the full task including priority', async () => {
    await saveTask(
      { title: 'Test task', dueDate: '2099-12-31', status: 'todo', priority: 'high',
        description: '', doctorIds: [], assigneeUids: [] },
      null
    )

    expect(setDoc).toHaveBeenCalledOnce()
    expect(updateDoc).not.toHaveBeenCalled()

    const [, task] = setDoc.mock.calls[0]
    expect(task).toMatchObject({ title: 'Test task', status: 'todo', priority: 'high' })
  })

  it('does not include comments in a new task', async () => {
    await saveTask(
      { title: 'No comments task', dueDate: '2099-12-31', status: 'todo', priority: 'medium',
        description: '', doctorIds: [], assigneeUids: [] },
      null
    )

    const [, task] = setDoc.mock.calls[0]
    expect(task).not.toHaveProperty('comments')
  })
})

describe('addComment', () => {
  it('uses arrayUnion so existing comments are preserved', async () => {
    const comment = { id: 'c1', text: 'hello', uid: 'u1', name: 'Alice', at: new Date().toISOString() }
    await addComment('task-123', comment)

    expect(updateDoc).toHaveBeenCalledOnce()
    expect(setDoc).not.toHaveBeenCalled()

    const [, patch] = updateDoc.mock.calls[0]
    expect(patch.comments).toBe(comment) // arrayUnion mock returns the value directly
  })
})
