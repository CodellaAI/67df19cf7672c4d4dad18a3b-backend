
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  likedTales: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tale'
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Remove password when converting to JSON
UserSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', UserSchema);
