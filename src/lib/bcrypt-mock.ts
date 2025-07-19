/**
 * Mock bcrypt implementation for development
 * This replaces bcryptjs to avoid dependency issues
 */

export default {
  async hash(password: string, saltRounds: number): Promise<string> {
    // For development, we'll use a simple hash simulation
    // In production, you would use the actual bcryptjs library
    const salt = Math.random().toString(36).substring(2, 15);
    return `$2b$${saltRounds}$${salt}$${Buffer.from(password).toString('base64')}`;
  },

  async compare(password: string, hashedPassword: string): Promise<boolean> {
    // For development, we'll extract the original password from our mock hash
    // In production, you would use the actual bcryptjs library
    try {
      const parts = hashedPassword.split('$');
      if (parts.length !== 4) return false;
      
      const originalPassword = Buffer.from(parts[3], 'base64').toString();
      return password === originalPassword;
    } catch (error) {
      return false;
    }
  },

  hashSync(password: string, saltRounds: number): string {
    // Synchronous version for compatibility
    const salt = Math.random().toString(36).substring(2, 15);
    return `$2b$${saltRounds}$${salt}$${Buffer.from(password).toString('base64')}`;
  },

  compareSync(password: string, hashedPassword: string): boolean {
    // Synchronous version for compatibility
    try {
      const parts = hashedPassword.split('$');
      if (parts.length !== 4) return false;
      
      const originalPassword = Buffer.from(parts[3], 'base64').toString();
      return password === originalPassword;
    } catch (error) {
      return false;
    }
  }
};