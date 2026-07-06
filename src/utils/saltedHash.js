const crypto = require('crypto');

class SaltedHash {
  constructor(salt, hash) {
    this._salt = salt;
    this._hash = hash;
  }

  get salt() {
    return this._salt;
  }

  get hash() {
    return this._hash;
  }

  static create(password) {
    const salt = SaltedHash._createSalt();
    const hash = SaltedHash._calculateHash(salt, password);
    return new SaltedHash(salt, hash);
  }

  static createFromExisting(salt, hash) {
    return new SaltedHash(salt, hash);
  }

  verify(password) {
    const h = SaltedHash._calculateHash(this._salt, password);
    return this._hash === h;
  }

  static _createSalt() {
    const r = SaltedHash._createRandomBytes(SaltedHash.saltLength);
    return r.toString('base64');
  }

  static _createRandomBytes(len) {
    return crypto.randomBytes(len);
  }

  static _calculateHash(salt, password) {
    // In C#: _toByteArray(salt + password)
    // This concatenates the strings first, then gets UTF8 bytes
    const data = Buffer.from(salt + password, 'utf8');
    
    // In C#: new SHA1CryptoServiceProvider().ComputeHash(data)
    const hash = crypto.createHash('sha1').update(data).digest();
    
    // In C#: Convert.ToBase64String(hash)
    return hash.toString('base64');
  }
}

SaltedHash.saltLength = 6;

module.exports = SaltedHash;
