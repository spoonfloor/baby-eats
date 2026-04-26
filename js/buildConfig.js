(function applyFavoriteEatsBuildConfig(global) {
  if (!global) return;
  global.__FAVORITE_EATS_BUILD__ = { target: 'web' };
})(typeof window !== 'undefined' ? window : globalThis);
