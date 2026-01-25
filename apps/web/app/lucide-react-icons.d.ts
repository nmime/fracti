// Type declarations for lucide-react deep imports
// This file provides TypeScript support for importing icons from lucide-react/dist/esm/icons/*

declare module 'lucide-react/dist/esm/icons/*' {
  import type { LucideIcon } from 'lucide-react'
  const icon: LucideIcon
  export default icon
}
