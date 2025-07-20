// Fallback cache handler for Docker builds without Redis
class FallbackCacheHandler {
  constructor() {
    console.log('Using fallback cache handler (no Redis)');
  }

  async get() {
    return null;
  }

  async set() {
    // No-op
  }

  async revalidateTag() {
    // No-op
  }
}

module.exports = FallbackCacheHandler;