const settingsVersion = 'inventra.settings.v1'
const departments = ['Administration', 'IT', 'Network Operations', 'Monitoring', 'Other']

export const defaultAppSettings = {
  notifications: {
    lowStock: true,
    outOfStock: true,
    stockMovements: true,
    purchaseOrders: true,
  },
  inventory: {
    defaultReorderThreshold: 5,
    defaultDepartment: 'Administration',
  },
}

function isAppSettings(value) {
  return value
    && typeof value === 'object'
    && typeof value.notifications?.lowStock === 'boolean'
    && typeof value.notifications?.outOfStock === 'boolean'
    && typeof value.notifications?.stockMovements === 'boolean'
    && typeof value.notifications?.purchaseOrders === 'boolean'
    && Number.isSafeInteger(value.inventory?.defaultReorderThreshold)
    && value.inventory.defaultReorderThreshold >= 0
    && value.inventory.defaultReorderThreshold <= 2147483647
    && departments.includes(value.inventory?.defaultDepartment)
}

export function readAppSettings(userId) {
  if (!userId) throw new Error('Unable to identify the signed-in account for its settings.')
  const savedSettings = window.localStorage.getItem(`${settingsVersion}.${userId}`)
  if (!savedSettings) return structuredClone(defaultAppSettings)

  let parsedSettings
  try {
    parsedSettings = JSON.parse(savedSettings)
  } catch {
    throw new Error('Saved settings could not be read. Review or replace them from the Settings page.')
  }
  if (!isAppSettings(parsedSettings)) {
    throw new Error('Saved settings have an unsupported format. Save the settings again to replace them.')
  }
  return parsedSettings
}

export function writeAppSettings(userId, settings) {
  if (!userId) throw new Error('Unable to identify the signed-in account for its settings.')
  if (!isAppSettings(settings)) throw new Error('One or more settings are invalid.')
  window.localStorage.setItem(`${settingsVersion}.${userId}`, JSON.stringify(settings))
}
