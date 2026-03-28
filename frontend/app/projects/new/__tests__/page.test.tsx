import NewProjectPage from '../page'
import { redirect } from 'next/navigation'

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

describe('NewProjectPage', () => {
  it('redirects to the project list create flow', () => {
    NewProjectPage()

    expect(redirect).toHaveBeenCalledWith('/projects?create=1')
  })
})
