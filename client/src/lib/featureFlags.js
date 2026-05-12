export const FEATURE_FLAGS = {
  diseaseTimeline: false,
}

export function isFeatureEnabled(flag) {
  return FEATURE_FLAGS[flag] === true
}
