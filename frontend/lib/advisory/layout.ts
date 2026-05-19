import type { CSSProperties } from 'react'

type AdvisoryLayoutStyle = CSSProperties & Record<`--${string}`, string | number>

export const ADVISORY_LAYOUT = {
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
} as const

export const ADVISORY_DESKTOP_QUERY = `(min-width: ${ADVISORY_LAYOUT.desktopMinWidth}px)`

export const ADVISORY_LAYOUT_STYLE: AdvisoryLayoutStyle = {
  '--advisory-nav-height': `${ADVISORY_LAYOUT.navHeight}px`,
  '--advisory-sidebar-width': `${ADVISORY_LAYOUT.sidebarWidth}px`,
  '--advisory-chat-min-width': `${ADVISORY_LAYOUT.chatMinWidth}px`,
  '--advisory-document-rail-width': `${ADVISORY_LAYOUT.documentRailWidth}px`,
  '--advisory-drawer-min-width': `${ADVISORY_LAYOUT.drawerMinWidth}px`,
  '--advisory-drawer-default-width': ADVISORY_LAYOUT.drawerDefaultWidth,
  '--advisory-drawer-max-width': ADVISORY_LAYOUT.drawerMaxWidth,
  '--advisory-input-max-height': `${ADVISORY_LAYOUT.inputMaxHeight}px`,
}
