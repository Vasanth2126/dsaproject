import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getCollection, saveDB } from "../config/db.js";

function wrapUser(user) {
  if (!user) return null;
  return {
    ...user,
    comparePassword: async function (candidate) {
      return bcrypt.compare(candidate, user.password);
    },
    toSafeObject: function () {
      return { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt };
    },
  };
}

const User = {
  async findOne(query) {
    const users = getCollection("users");
    const found = users.find((u) => {
      for (const [k, v] of Object.entries(query)) {
        if (k === "email" && u.email?.toLowerCase() !== v?.toLowerCase()) return false;
        if (k !== "email" && u[k] !== v) return false;
      }
      return true;
    });
    return wrapUser(found);
  },

  async findById(id) {
    const users = getCollection("users");
    const found = users.find((u) => u._id === String(id) || u.id === String(id));
    return wrapUser(found);
  },

  async create({ name, email, password }) {
    const users = getCollection("users");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      _id: uuidv4(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveDB();
    return wrapUser(newUser);
  },
};

export default User;
