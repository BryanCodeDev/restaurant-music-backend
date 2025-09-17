// src/models/AuthToken.js - Modelo para tokens de autenticación
const { executeQuery } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class AuthToken {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.userType = data.user_type;
    this.tokenHash = data.token_hash;
    this.tokenType = data.token_type;
    this.expiresAt = data.expires_at;
    this.usedAt = data.used_at;
    this.ipAddress = data.ip_address;
    this.userAgent = data.user_agent;
    this.createdAt = data.created_at;
  }

  // Crear nuevo token
  static async create(data) {
    try {
      const tokenId = data.id || uuidv4();
      const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');

      await executeQuery(
        `INSERT INTO auth_tokens (
          id, user_id, user_type, token_hash, token_type, expires_at,
          used_at, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tokenId, data.userId, data.userType, tokenHash, data.tokenType,
          data.expiresAt, null, data.ipAddress || null, data.userAgent || null
        ]
      );

      return await AuthToken.findById(tokenId);
    } catch (error) {
      throw new Error(`Error creating auth token: ${error.message}`);
    }
  }

  // Buscar por token hash
  static async findByToken(token, tokenType = null) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      let query = 'SELECT * FROM auth_tokens WHERE token_hash = ?';
      let params = [tokenHash];

      if (tokenType) {
        query += ' AND token_type = ?';
        params.push(tokenType);
      }

      const { rows } = await executeQuery(query, params);

      if (rows.length > 0) {
        const row = rows[0];
        return new AuthToken(row);
      }
      return null;
    } catch (error) {
      throw new Error(`Error finding token: ${error.message}`);
    }
  }

  // Buscar por user ID y type
  static async findByUser(userId, userType, tokenType = null) {
    try {
      let query = 'SELECT * FROM auth_tokens WHERE user_id = ? AND user_type = ?';
      let params = [userId, userType];

      if (tokenType) {
        query += ' AND token_type = ?';
        params.push(tokenType);
      }

      query += ' ORDER BY created_at DESC LIMIT 1';

      const { rows } = await executeQuery(query, params);

      return rows.length > 0 ? new AuthToken(rows[0]) : null;
    } catch (error) {
      throw new Error(`Error finding tokens by user: ${error.message}`);
    }
  }

  // Verificar si token es válido (no expirado, no usado si single-use)
  isValid() {
    const now = new Date();
    if (this.expiresAt && new Date(this.expiresAt) < now) {
      return false;
    }
    // Para tokens single-use como email_verification o password_reset, verificar used_at
    if (['email_verification', 'password_reset'].includes(this.tokenType) && this.usedAt) {
      return false;
    }
    return true;
  }

  // Marcar token como usado
  async markAsUsed() {
    try {
      await executeQuery(
        'UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [this.id]
      );
      this.usedAt = new Date();
      return this;
    } catch (error) {
      throw new Error(`Error marking token as used: ${error.message}`);
    }
  }

  // Eliminar token expirado o específico
  static async deleteExpired() {
    try {
      await executeQuery(
        'DELETE FROM auth_tokens WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL'
      );
      return true;
    } catch (error) {
      throw new Error(`Error deleting expired tokens: ${error.message}`);
    }
  }

  static async deleteById(id) {
    try {
      await executeQuery('DELETE FROM auth_tokens WHERE id = ?', [id]);
      return true;
    } catch (error) {
      throw new Error(`Error deleting token: ${error.message}`);
    }
  }

  static async deleteByUser(userId, userType) {
    try {
      await executeQuery(
        'DELETE FROM auth_tokens WHERE user_id = ? AND user_type = ?',
        [userId, userType]
      );
      return true;
    } catch (error) {
      throw new Error(`Error deleting user tokens: ${error.message}`);
    }
  }

  // Serializar para JSON (sin token hash)
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      userType: this.userType,
      tokenType: this.tokenType,
      expiresAt: this.expiresAt,
      usedAt: this.usedAt,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      isValid: this.isValid(),
      createdAt: this.createdAt
    };
  }
}

module.exports = AuthToken;