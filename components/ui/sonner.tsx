import { Toaster as SonnerToaster } from 'sonner'

export function Toaster(props: {
  position?: 'bottom-right'
  closeButton?: boolean
}) {
  return <SonnerToaster {...props} />
}
