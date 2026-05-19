import { ADVISORY_DESKTOP_QUERY, ADVISORY_LAYOUT, ADVISORY_LAYOUT_STYLE } from './layout'

describe('advisory layout constants', () => {
  it('[2.3-UNIT-001][P1] codifies the complete Story 2.3 desktop layout contract', () => {
    expect(ADVISORY_LAYOUT).toMatchObject({
      navHeight: 56,
      hostSidebarWidth: 200,
      sidebarWidth: 240,
      chatMinWidth: 480,
      documentRailWidth: 64,
      shellHorizontalPadding: 48,
      drawerMinWidth: 320,
      drawerDefaultWidth: '38vw',
      drawerMaxWidth: '50vw',
      inputMaxHeight: 200,
      desktopMinWidth: 1032,
    })
    expect(ADVISORY_DESKTOP_QUERY).toBe('(min-width: 1032px)')
  })

  it('[2.3-UNIT-002][P1] exposes advisory layout constraints as stable CSS variables', () => {
    expect(ADVISORY_LAYOUT_STYLE).toMatchObject({
      '--advisory-nav-height': '56px',
      '--advisory-sidebar-width': '240px',
      '--advisory-chat-min-width': '480px',
      '--advisory-document-rail-width': '64px',
      '--advisory-drawer-min-width': '320px',
      '--advisory-drawer-default-width': '38vw',
      '--advisory-drawer-max-width': '50vw',
      '--advisory-input-max-height': '200px',
    })
  })
})
