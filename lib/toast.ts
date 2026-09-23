import { toast } from 'sonner'

export type ToastAction = {
  label: string
  onClick: () => void
}

export function showSuccessToast(message: string, description?: string) {
  return toast.success(message, {
    description,
  })
}

export function showInfoToast(message: string, description?: string) {
  return toast.info(message, {
    description,
  })
}

export function showWarningToast(message: string, description?: string) {
  return toast.warning(message, {
    description,
  })
}

export function showErrorToast(
  message: string,
  description?: string,
  action?: ToastAction,
) {
  return toast.error(message, {
    description,
    action: action
      ? {
          label: action.label,
          onClick: action.onClick,
        }
      : undefined,
  })
}

export function showLoadingToast(message: string, description?: string) {
  return toast.loading(message, {
    description,
  })
}

export function dismissToast(id?: string | number) {
  toast.dismiss(id)
}

export function updateToast(
  id: string | number,
  message: string,
  type: 'success' | 'info' | 'warning' | 'error',
  description?: string,
) {
  return toast[type](message, {
    id,
    description,
  })
}

export function showPromiseToast<T>(
  promise: Promise<T>,
  options: {
    loading: string
    success: string | ((value: T) => string)
    error: string | ((error: unknown) => string)
  },
) {
  return toast.promise(promise, options)
}
