const { usersDb } = require('../config/db');
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4 } = require('crypto');

class User {
  // Yeni istifadəçi yarat
  static async create(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const newUser = {
      _id: uuidv4(),
      full_name: userData.full_name,
      email: userData.email,
      password: hashedPassword,
      role: userData.role || 'Customer',
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      profile_picture: userData.profile_picture || null,
      passwordChangedAt: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      usersDb.insert(newUser, (err, doc) => {
        if (err) return reject(err);
        resolve(doc);
      });
    });
  }

  // Bütün istifadəçiləri göstər
  static async findAll() {
    return new Promise((resolve, reject) => {
      usersDb.find({}, (err, users) => {
        if (err) return reject(err);
        resolve(users);
      });
    });
  }

  // İstifadəçini email ilə tap
  static async findByEmail(email) {
    return new Promise((resolve, reject) => {
      usersDb.findOne({ email }, (err, user) => {
        if (err) return reject(err);
        resolve(user);
      });
    });
  }

  // İstifadəçini ID ilə tap
  static async findById(id) {
    return new Promise((resolve, reject) => {
      usersDb.findOne({ _id: id }, (err, user) => {
        if (err) return reject(err);
        resolve(user);
      });
    });
  }

  // Şifrəni yenilə — şifrə dəyişdikdə köhnə tokenlər etibarsızlaşsın deyə
  // passwordChangedAt vaxtı qeyd olunur (sessiyaların ləğvi üçün).
  static async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return new Promise((resolve, reject) => {
      usersDb.update({ _id: userId }, { $set: { password: hashedPassword, passwordChangedAt: new Date().toISOString(), updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }

  // Profil məlumatlarını yenilə
  static async updateProfile(userId, updateData) {
    return new Promise((resolve, reject) => {
      usersDb.update({ _id: userId }, { $set: { ...updateData, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        if (numUpdated !== 1) return resolve(false);
        usersDb.findOne({ _id: userId }, (err, user) => {
          if (err) return reject(err);
          resolve(user);
        });
      });
    });
  }

  // İstifadəçi rolunu yenilə
  static async updateRole(userId, role) {
    return new Promise((resolve, reject) => {
      usersDb.update({ _id: userId }, { $set: { role, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }

  // İstifadəçinin aktivlik statusunu yenilə
  static async setActive(userId, isActive) {
    return new Promise((resolve, reject) => {
      usersDb.update({ _id: userId }, { $set: { isActive, updated_at: new Date().toISOString() } }, {}, (err, numUpdated) => {
        if (err) return reject(err);
        resolve(numUpdated === 1);
      });
    });
  }
}

module.exports = User;